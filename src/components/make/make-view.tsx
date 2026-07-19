"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Wand2,
  X,
  Plus,
  Coins,
  Download,
  Bookmark,
  Check,
  ArrowRight,
  ImagePlus,
  Undo2,
  Film,
  Music,
  RefreshCw,
  Lightbulb,
  UserRound,
  Mic,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Pencil,
  Rows3,
  ScrollText,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor, videoRate, DEFAULT_MODEL_ID } from "@/lib/models";
import { ASSET_CLASSES, CLASS_BY_KEY, composeFromAssets } from "@/lib/catalog";
import { storyboardDurationSec } from "@/lib/storyboard";
import { PURPOSE_BY_ID, DEFAULT_PURPOSE_ID } from "@/lib/purposes";
import {
  DURATIONS,
  REF_IMAGE_LIMIT,
  REF_VIDEO_LIMIT,
  STYLE_LIMIT,
  type AspectRatio,
  type Asset,
  type AssetClass,
  type Modality,
  type Tier,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Modal } from "@/components/ui";
import {
  AssetThumb,
  ClassIcon,
  ResultHero,
  CompositeBadge,
  classifyGenError,
  planSegments,
  ScriptBeats,
} from "@/components/shared";

type Picks = Partial<Record<AssetClass, string>>;

/**
 * The three flavors of the engine — one card each, personality included.
 * Mini and Pro are real models; 4K is Pro with the resolution cranked.
 * Picking a card sets the model and its default quality; each card owns
 * the qualities it then lets you choose (4K is locked to 4K, full stop).
 */
const MODEL_CHOICES = [
  {
    key: "mini",
    label: "Mini 2.0",
    emoji: "🐇",
    tagline: "Zippy little drafts — try ideas fast",
    modelId: "seedance-2-mini",
    resolution: "720p",
    qualities: ["480p", "720p"],
  },
  {
    key: "pro",
    label: "2.0 Pro",
    emoji: "🎬",
    tagline: "The cinematic one — crisp 1080p",
    modelId: "seedance-2-pro",
    resolution: "1080p",
    qualities: ["720p", "1080p"],
  },
  {
    key: "4k",
    label: "2.0 4K",
    emoji: "💎",
    tagline: "Every pore, every pixel — max detail",
    modelId: "seedance-2-pro",
    resolution: "4K",
    qualities: ["4K"],
  },
] as const;

/** Section heading on the one-page Studio — a divider with title + hint. */
function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3.5 mt-6 border-t border-line pt-5">
      <h2 className="text-[15px] font-bold tracking-tight text-fg">{title}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>
    </div>
  );
}

/** The video Shot Board: exact frames OR reference media, plus text-only influences. */
interface Board {
  firstFrame: string | null;
  lastFrame: string | null;
  refs: string[];
  refVideos: string[];
  influences: string[];
}

const EMPTY_BOARD: Board = { firstFrame: null, lastFrame: null, refs: [], refVideos: [], influences: [] };

type BoardZone = "firstFrame" | "lastFrame" | "refs" | "refVideos" | "influences";

/** Visual identity per input type so every area reads at a glance. */
const INPUT_TONES = {
  image: {
    border: "border-accent/30",
    bg: "bg-accent-soft/40",
    chip: "bg-accent text-white",
    pill: "bg-accent-soft text-accent-2",
  },
  video: {
    border: "border-teal/40",
    bg: "bg-teal-soft/50",
    chip: "bg-teal text-white",
    pill: "bg-teal-soft text-teal",
  },
  audio: {
    border: "border-warn/40",
    bg: "bg-warn/10",
    chip: "bg-warn text-white",
    pill: "bg-warn/15 text-warn",
  },
} as const;

/** A bare row for one input type: tiny label + count, then the squares. */
function SlotRow({
  tone,
  icon,
  label,
  count,
  cap,
  dim,
  children,
}: {
  tone: keyof typeof INPUT_TONES;
  icon: React.ReactNode;
  label: string;
  count: number;
  cap: number;
  dim?: boolean;
  children: React.ReactNode;
}) {
  const t = INPUT_TONES[tone];
  return (
    <div className={cn('transition-opacity', dim && 'opacity-40')}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md', t.chip)}>
          {icon}
        </span>
        <span className="text-[12px] font-semibold text-fg">{label}</span>
        <span className="ml-auto text-[11px] font-medium tabular-nums text-faint">
          {count}/{cap}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** One pressable slot square — filled shows the asset + tag; empty shows +/tag. */
function SlotSquare({
  asset,
  tag,
  wide,
  isNext,
  disabled,
  highlight,
  emptyLabel,
  onPress,
  onRemove,
  ...dropProps
}: {
  asset: Asset | null;
  tag: string;
  wide?: boolean;
  isNext?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  emptyLabel?: string;
  onPress: () => void;
  onRemove: () => void;
} & React.HTMLAttributes<HTMLElement>) {
  const size = wide ? 'h-16 w-28' : 'h-16 w-16';
  if (asset) {
    // FILLED — a clear "added" state: solid accent ring + a check badge.
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-lg border-2 border-accent ring-2 ring-accent/25',
          size,
        )}
      >
        <AssetThumb a={asset} className="h-full w-full" />
        <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white shadow">
          <Check size={10} strokeWidth={3} />
        </span>
        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/65 px-1 text-[9px] font-bold text-white">
          {tag}
        </span>
        <button
          onClick={onRemove}
          // p-1.5 + 12px glyph ≈ a 24px+ hit area — tappable on phones (the
          // old 15px target was nearly impossible to hit with a thumb).
          className="absolute right-0 top-0 rounded-bl-lg rounded-tr-[inherit] bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          aria-label={'Remove ' + tag}
        >
          <X size={12} />
        </button>
      </div>
    );
  }
  // EMPTY — the next open slot pulses to invite a click; later ones sit muted.
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      {...(disabled ? {} : dropProps)}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed transition-colors',
        size,
        isNext && !disabled
          ? 'slot-next border-line-2 text-accent-2 hover:border-accent hover:bg-accent-soft'
          : 'border-line text-faint opacity-40',
        disabled && 'cursor-not-allowed',
        highlight && isNext && 'border-accent bg-accent-soft',
      )}
    >
      {isNext && !disabled ? <Plus size={15} strokeWidth={2.5} /> : null}
      <span className="text-[9px] font-bold uppercase tracking-wide">{emptyLabel ?? tag}</span>
    </button>
  );
}

export function MakeView({ mode }: { mode?: Modality }) {
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const assets = useStore((s) => s.assets);
  const generate = useStore((s) => s.generate);
  const videos = useStore((s) => s.videos);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const draftElements = useStore((s) => s.draftElements);
  const draftDirection = useStore((s) => s.draftDirection);
  const draftRefAssetId = useStore((s) => s.draftRefAssetId);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftRef = useStore((s) => s.setDraftRef);
  const draftPlanRef = useStore((s) => s.draftPlanRef);
  const setDraftPlanRef = useStore((s) => s.setDraftPlanRef);
  const plans = useStore((s) => s.plans);
  // The plan shot this session is producing (provenance stamped on generate).
  const [planRef, setPlanRef] = useState<{ planId: string; ideaId: string } | null>(null);
  const planOfRef = planRef ? plans.find((p) => p.id === planRef.planId) : null;
  const planIdea = planOfRef?.ideas.find((i) => i.id === planRef?.ideaId) ?? null;
  const shotNumber = planIdea && planOfRef ? planOfRef.ideas.indexOf(planIdea) + 1 : 0;
  // Script section: organized beat view when the prompt has a timeline; textarea to edit.
  const [editScript, setEditScript] = useState(false);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const initialPurpose = PURPOSE_BY_ID[mode === "image" ? "still" : DEFAULT_PURPOSE_ID];
  const [purposeId, setPurposeId] = useState<string>(initialPurpose.id);
  const [modality, setModality] = useState<Modality>(initialPurpose.modality);
  const [modelId, setModelId] = useState<string>(initialPurpose.modelId || DEFAULT_MODEL_ID);
  const [prompt, setPrompt] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  /** Format chosen and tucked away — Edit on the summary reopens the pickers. */
  const [formatLocked, setFormatLocked] = useState(false);
  /** The attached storyboard (asset id) — its sheet + story prompt ride with the shot. */
  const [storyboardId, setStoryboardId] = useState<string | null>(null);
  const [boardPickZone, setBoardPickZone] = useState<BoardZone | null>(null);
  const [dragZone, setDragZone] = useState<BoardZone | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialPurpose.aspectRatio);
  const [durationSec, setDurationSec] = useState<number>(initialPurpose.durationSec);
  const [tier] = useState<Tier>("standard");
  const [resolution, setResolution] = useState<string>(getModel(initialPurpose.modelId).arkResolution ?? "720p");
  const [audio] = useState(true);
  const [pickClass, setPickClass] = useState<AssetClass | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [directorError, setDirectorError] = useState<string | null>(null);
  const [draftBackup, setDraftBackup] = useState<string | null>(null);
  /** Open state of the # mention picker: null = closed, else the partial tag. */
  const [tagQuery, setTagQuery] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const resultRef = useRef<HTMLDivElement>(null);
  // Real backend configured but visitor not signed in → route them to auth
  // instead of quietly simulating (a sample clip reads as broken generation).
  const needsSignIn = cloudConfigured && !cloudUser;

  // Draft-first for small balances: the default is 2.0 Pro (~90cr for 5s),
  // which a low balance can't afford — the first click would be a disabled
  // button. Once the balance is known, if it can't cover a single 5s render
  // on the preset model, start them on Mini instead. Runs once per mount and
  // never overrides a choice the user made themselves.
  const autoDrafted = useRef(false);
  useEffect(() => {
    if (!hydrated || autoDrafted.current || modality !== "video") return;
    autoDrafted.current = true;
    const preset = getModel(modelId);
    const presetCost = priceFor(preset, { durationSec: 5 });
    if (credits < presetCost && preset.id !== "seedance-2-mini") {
      setModelId("seedance-2-mini");
      setResolution("720p");
    }
  }, [hydrated, credits, modality, modelId]);

  // Consume drafts handed over from Assets ("Use in Make") or Library ("Remix").
  useEffect(() => {
    const ids = [
      ...(draftRefAssetId ? [draftRefAssetId] : []),
      ...(draftElements ?? []),
    ].filter((id) => byId[id]);
    if (draftRefAssetId) setDraftRef(null);
    if (draftElements) setDraftElements(null);
    if (draftDirection != null) {
      setPrompt(draftDirection);
      setDraftDirection(null);
    }
    if (draftPlanRef) {
      setPlanRef(draftPlanRef);
      // A fresh shot opens in the organized script view.
      setEditScript(false);
      // The plan was written for a specific length — preset it.
      const idea = plans
        .find((p) => p.id === draftPlanRef.planId)
        ?.ideas.find((i) => i.id === draftPlanRef.ideaId);
      if (idea?.durationSec && (DURATIONS as readonly number[]).includes(idea.durationSec)) {
        setDurationSec(idea.durationSec);
      }
      setDraftPlanRef(null);
    }
    if (ids.length) {
      if (mode === "image") {
        const seed: Picks = {};
        ids.forEach((id) => {
          const a = byId[id];
          if (a?.class && !seed[a.class]) seed[a.class] = id;
        });
        setPicks((p) => ({ ...seed, ...p }));
      } else {
        // A handed-over storyboard attaches as THE storyboard, not a plain image.
        const sb = ids.map((id) => byId[id]).find((a) => a?.class === "storyboard");
        if (sb) {
          setStoryboardId(sb.id);
          // The board was written for a specific video length — preset it.
          const dur = storyboardDurationSec(sb);
          if (dur && (DURATIONS as readonly number[]).includes(dur)) setDurationSec(dur);
        }
        // Video: media assets become references, audio/motion become influences.
        setBoard((b) => {
          const next = {
            ...b,
            refs: [...b.refs],
            refVideos: [...b.refVideos],
            influences: [...b.influences],
          };
          ids.forEach((id) => {
            const a = byId[id];
            if (!a) return;
            if (a.kind === "audio" || a.kind === "prompt") {
              if (!next.influences.includes(id)) next.influences.push(id);
            } else if (a.kind === "video") {
              if (!next.refVideos.includes(id) && next.refVideos.length < REF_VIDEO_LIMIT)
                next.refVideos.push(id);
            } else if (!next.refs.includes(id) && next.refs.length < REF_IMAGE_LIMIT) {
              next.refs.push(id);
            }
          });
          return next;
        });
      }
    }
    // Landing links arrive as ?purpose=…&prompt=… — preconfigure the studio.
    const params = new URLSearchParams(window.location.search);
    const linkedPurpose = params.get("purpose");
    if (
      linkedPurpose &&
      PURPOSE_BY_ID[linkedPurpose] &&
      (!mode || PURPOSE_BY_ID[linkedPurpose].modality === mode)
    ) {
      applyPurpose(linkedPurpose);
    }
    const linked = params.get("prompt");
    if (linked) setPrompt(linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPurpose(id: string) {
    const p = PURPOSE_BY_ID[id];
    if (!p) return;
    setPurposeId(id);
    setModality(p.modality);
    setModelId(p.modelId);
    setResolution(getModel(p.modelId).arkResolution ?? "720p");
    setAspectRatio(p.aspectRatio);
    setDurationSec(p.durationSec);
  }

  const purpose = PURPOSE_BY_ID[purposeId] ?? PURPOSE_BY_ID[DEFAULT_PURPOSE_ID];
  // Surface this purpose's asset classes first; the rest stay available.
  const orderedClasses = [
    ...purpose.classes,
    ...ASSET_CLASSES.map((c) => c.key).filter((k) => !purpose.classes.includes(k)),
  ];

  const model = getModel(modelId);
  // Which flavor card is active: Mini by model, 4K by resolution, else Pro.
  const activeChoice =
    MODEL_CHOICES.find((c) =>
      modelId === "seedance-2-mini" ? c.key === "mini" : resolution === "4K" ? c.key === "4k" : c.key === "pro",
    ) ?? MODEL_CHOICES[1];

  /** Public https URL Ark can fetch, or null (localhost paths can't steer). */
  const publicUrl = (a: Asset): string | null => {
    if (a.url.startsWith("https://")) return a.url;
    if (
      a.url.startsWith("/") &&
      typeof window !== "undefined" &&
      window.location.protocol === "https:"
    ) {
      return window.location.origin + a.url;
    }
    return null;
  };

  const boardIds = [
    board.firstFrame,
    board.lastFrame,
    ...board.refs,
    ...board.refVideos,
    ...board.influences,
  ].filter(Boolean) as string[];

  const pickedAssets =
    modality === "video"
      ? ([...new Set(boardIds)].map((id) => byId[id]).filter(Boolean) as Asset[])
      : (ASSET_CLASSES.map((c) => picks[c.key])
          .filter(Boolean)
          .map((id) => byId[id as string])
          .filter(Boolean) as Asset[]);

  const refImageAssets = board.refs.map((id) => byId[id]).filter(Boolean) as Asset[];
  const refVideoAssets = board.refVideos.map((id) => byId[id]).filter(Boolean) as Asset[];

  // Saved characters the creator can cast into the shot.
  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );

  // Saved storyboards — the whole video boarded as one sheet + its story prompt.
  const storyboards = useMemo(() => assets.filter((a) => a.class === "storyboard"), [assets]);
  const activeStoryboard = storyboardId ? byId[storyboardId] ?? null : null;

  /**
   * Attach a storyboard to the shot (one at a time): its sheet becomes an
   * image reference and, if the script box is empty, its story-flow prompt
   * becomes the script. finalPrompt additionally guarantees the flow rides
   * with the generation even when the creator rewrites the box.
   */
  function attachStoryboard(sb: Asset) {
    const on = storyboardId === sb.id;
    setBoard((b) => {
      // Swapping boards replaces the previous sheet in the image slots.
      const refs = b.refs.filter((id) => id !== sb.id && id !== storyboardId);
      return {
        ...b,
        // Attaching uses reference mode — clear any exact-frame selection.
        firstFrame: on ? b.firstFrame : null,
        lastFrame: on ? b.lastFrame : null,
        refs: !on && refs.length < REF_IMAGE_LIMIT ? [...refs, sb.id] : refs,
      };
    });
    setStoryboardId(on ? null : sb.id);
    if (!on && !prompt.trim() && sb.promptFragment) setPrompt(sb.promptFragment);
    else if (on && sb.promptFragment && prompt.trim() === sb.promptFragment.trim()) setPrompt("");
    // The board was written for a specific video length — preset the clip to it.
    if (!on) {
      const dur = storyboardDurationSec(sb);
      if (dur && (DURATIONS as readonly number[]).includes(dur)) setDurationSec(dur);
    }
  }

  // The sheet can also leave via its Images slot's ✕ — detach the storyboard too.
  useEffect(() => {
    if (storyboardId && !board.refs.includes(storyboardId)) setStoryboardId(null);
  }, [board.refs, storyboardId]);
  const voiceForCharacter = (c: Asset) =>
    assets.find((a) => a.categoryId === c.categoryId && a.kind === "audio") ?? null;

  /** Cast a character: their sheet fills an image slot, their voice a sound slot. */
  function castCharacter(c: Asset) {
    const voice = voiceForCharacter(c);
    setBoard((b) => {
      const on = b.refs.includes(c.id);
      const refs = on
        ? b.refs.filter((id) => id !== c.id)
        : b.refs.length < REF_IMAGE_LIMIT
          ? [...b.refs, c.id]
          : b.refs;
      const influences = voice
        ? on
          ? b.influences.filter((id) => id !== voice.id)
          : b.influences.includes(voice.id) || b.influences.length >= STYLE_LIMIT
            ? b.influences
            : [...b.influences, voice.id]
        : b.influences;
      // Casting uses reference mode — clear any exact-frame selection.
      return { ...b, firstFrame: on ? b.firstFrame : null, lastFrame: on ? b.lastFrame : null, refs, influences };
    });
  }

  /**
   * Every board slot gets a referenceable tag (#I1, #V2, #A1, #F1…). Tags
   * expand to wording the model understands ("image 1 (Nova)") since media
   * is sent to Seedance in exactly this order.
   */
  const taggedMedia = [
    ...(board.firstFrame && byId[board.firstFrame]
      ? [{ tag: "F1", asset: byId[board.firstFrame], expand: "the first frame" }]
      : []),
    ...(board.lastFrame && byId[board.lastFrame]
      ? [{ tag: "F2", asset: byId[board.lastFrame], expand: "the last frame" }]
      : []),
    ...refImageAssets.map((a, i) => ({
      tag: `I${i + 1}`,
      asset: a,
      expand:
        a.id === storyboardId
          ? `image ${i + 1} — the storyboard sheet showing every shot of this video in order`
          : `image ${i + 1} (${a.name})`,
    })),
    ...refVideoAssets.map((a, i) => ({
      tag: `V${i + 1}`,
      asset: a,
      expand: `video ${i + 1} (${a.name})`,
    })),
    ...board.influences
      .map((id, i) => {
        const a = byId[id];
        return a ? { tag: `A${i + 1}`, asset: a, expand: a.promptFragment ?? a.name } : null;
      })
      .filter(Boolean) as { tag: string; asset: Asset; expand: string }[],
  ];

  /** Replace #TAG mentions with model-readable references. */
  function expandTags(text: string): string {
    if (!text.includes("#")) return text;
    return text.replace(/#([A-Za-z]\d{1,2})\b/g, (m, raw) => {
      const hit = taggedMedia.find((t) => t.tag.toLowerCase() === String(raw).toLowerCase());
      return hit ? hit.expand : m;
    });
  }

  /** Drop/click assignment with kind checks, caps, and mode exclusivity. */
  function assignToZone(zone: BoardZone, assetId: string) {
    const a = byId[assetId];
    if (!a) return;
    // Route by kind so any drop lands somewhere sensible.
    if (a.kind === "audio" || a.kind === "prompt") zone = "influences";
    else if (a.kind === "video" && zone !== "influences") zone = "refVideos";
    if (zone === "firstFrame" || zone === "lastFrame") {
      if (a.kind !== "image") return;
      // Frames mode excludes reference media (API contract) — but never wipe
      // someone's picks silently: ask before clearing them.
      const losing = board.refs.length + board.refVideos.length;
      if (losing > 0) {
        const ok = confirm(
          `Exact start/end frames can't be combined with reference media — remove your ${losing} reference${losing > 1 ? "s" : ""}${storyboardId ? " (this detaches the storyboard)" : ""} and switch?`,
        );
        if (!ok) return;
      }
      setBoard((b) => ({ ...b, [zone]: assetId, refs: [], refVideos: [] }));
    } else if (zone === "refs") {
      if (a.kind !== "image") return;
      setBoard((b) => {
        if (b.refs.includes(assetId) || b.refs.length >= REF_IMAGE_LIMIT) return b;
        return { ...b, firstFrame: null, lastFrame: null, refs: [...b.refs, assetId] };
      });
    } else if (zone === "refVideos") {
      setBoard((b) => {
        if (b.refVideos.includes(assetId) || b.refVideos.length >= REF_VIDEO_LIMIT) return b;
        return { ...b, firstFrame: null, lastFrame: null, refVideos: [...b.refVideos, assetId] };
      });
    } else {
      setBoard((b) =>
        b.influences.includes(assetId) || b.influences.length >= STYLE_LIMIT
          ? b
          : { ...b, influences: [...b.influences, assetId] },
      );
    }
  }

  function removeFromBoard(zone: BoardZone, assetId?: string) {
    setBoard((b) => {
      if (zone === "firstFrame") return { ...b, firstFrame: null };
      if (zone === "lastFrame") return { ...b, lastFrame: null };
      if (zone === "refs") return { ...b, refs: b.refs.filter((id) => id !== assetId) };
      if (zone === "refVideos")
        return { ...b, refVideos: b.refVideos.filter((id) => id !== assetId) };
      return { ...b, influences: b.influences.filter((id) => id !== assetId) };
    });
  }

  const zoneDropProps = (zone: BoardZone) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragZone(zone);
    },
    onDragLeave: () => setDragZone((z) => (z === zone ? null : z)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragZone(null);
      const id = e.dataTransfer.getData("text/plain");
      if (id) assignToZone(zone, id);
    },
  });

  // The typed prompt doubles as the director's note when assets are picked;
  // #tags expand to model-readable references, then the purpose's style
  // language is woven in at the end.
  const expandedPrompt = expandTags(prompt);
  const finalPrompt = useMemo(() => {
    // The storyboard isn't a slot pick (no "the subject" scaffold) — its flow
    // is woven in below instead.
    let composed = composeFromAssets(
      pickedAssets.filter((a) => a.class !== "storyboard"),
      expandedPrompt,
    );
    // An attached storyboard's story prompt ALWAYS rides with the generation:
    // if the script no longer contains it (the creator rewrote or cleared the
    // box), weave it back in alongside the sheet reference.
    const flow = activeStoryboard?.promptFragment?.trim();
    if (flow) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
      if (!norm(composed).includes(norm(flow).slice(0, 80))) {
        composed = `${composed ? `${composed}\n\n` : ""}Follow the attached storyboard sheet panel by panel — it boards every shot of this video in order: ${flow}`;
      }
    }
    if (!composed || !purpose.styleSuffix) return composed;
    return `${composed} — ${purpose.styleSuffix}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAssets, expandedPrompt, purpose.styleSuffix, activeStoryboard]);
  const cost = priceFor(model, {
    durationSec,
    count: 1,
    hasRefs: pickedAssets.length > 0,
    resolution,
  });
  const canAfford = credits >= cost;
  const aspectValid = /^\d{1,2}:\d{1,2}$/.test(aspectRatio);
  // `hydrated` also gates the brief window while a signed-in account's cloud
  // state is loading, so a spend can't race the authoritative balance.
  const canGenerate = hydrated && finalPrompt.trim().length > 0 && canAfford && aspectValid;
  // Locked (unsubscribed): keep Generate clickable so it opens the paywall
  // instead of sitting disabled behind a "not enough credits" message.
  const locked = cloudConfigured && subscribed === false;
  const activeJob = videos.find((v) => v.id === activeJobId) ?? null;
  const rendering = activeJob?.status === "rendering";

  function setPick(cls: AssetClass, id: string | null) {
    setPicks((p) => ({ ...p, [cls]: id ?? undefined }));
  }

  // Bring the render (and then the finished shot) into view.
  useEffect(() => {
    if (activeJob) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeJob?.status === "succeeded", !!activeJob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Steering media from the board, resolved to URLs Ark can fetch.
  const firstFrameUrl =
    board.firstFrame && byId[board.firstFrame] ? publicUrl(byId[board.firstFrame]) : null;
  const lastFrameUrl =
    board.lastFrame && byId[board.lastFrame] ? publicUrl(byId[board.lastFrame]) : null;
  const refImageUrls = refImageAssets.map(publicUrl).filter(Boolean) as string[];
  const refVideoUrls = refVideoAssets.map(publicUrl).filter(Boolean) as string[];

  async function onDirect() {
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    const brief = expandTags(prompt).trim();
    if (!brief || directing) return;
    // Browsing is free; running the Director isn't — prompt subscribe if locked.
    if (useStore.getState().blockIfLocked()) return;
    setDirecting(true);
    setDirectorError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in first");
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brief,
          modality,
          durationSec, // the locked clip length — the cleaned prompt must fit it exactly
          purpose: purpose.id === "custom" ? null : `${purpose.label} — ${purpose.tagline}`,
          // Named exactly as Seedance will see them ("image 1", "video 1"…) so
          // the cleaned prompt can reference each attached thing explicitly.
          assets: taggedMedia.length
            ? taggedMedia.map((t) => `${t.expand} — ${t.asset.promptFragment ?? t.asset.name}`)
            : pickedAssets.map((a) => a.promptFragment ?? a.name),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.prompt) throw new Error(data.error ?? "The Director is unavailable");
      setDraftBackup(brief);
      setPrompt(data.prompt);
    } catch (e) {
      setDirectorError(e instanceof Error ? e.message : "The Director is unavailable");
    } finally {
      setDirecting(false);
    }
  }

  function startGenerate(promptText: string) {
    if (rendering) return;
    // Poster must be an image — a video url as poster renders a blank tile.
    const posterSource =
      pickedAssets.find((a) => a.class === "scene" && a.kind === "image") ??
      pickedAssets.find((a) => a.kind === "image");
    const posterUrl = posterSource?.posterUrl ?? posterSource?.url;
    const id = generate({
      prompt: promptText,
      tier,
      durationSec,
      aspectRatio,
      audio,
      modelId,
      modality,
      elements: pickedAssets.map((a) => a.id),
      direction: promptText,
      posterUrl,
      planId: planRef?.planId,
      ideaId: planRef?.ideaId,
      firstFrameUrl: firstFrameUrl ?? undefined,
      lastFrameUrl: firstFrameUrl ? lastFrameUrl ?? undefined : undefined,
      resolution,
      refImageUrls: refImageUrls.length ? refImageUrls : undefined,
      refVideoUrls: refVideoUrls.length ? refVideoUrls : undefined,
    });
    setActiveJobId(id);
    setSavedMsg(false);
  }

  function onGenerate() {
    if (rendering) return;
    if (locked) {
      useStore.getState().blockIfLocked(); // opens the subscribe paywall
      return;
    }
    if (!canGenerate) return;
    startGenerate(finalPrompt);
  }

  // After a content-policy failure: let the LLM rewrite the prompt to pass
  // the filters, drop it into the box, and generate again.
  async function onRewriteRetry() {
    if (rewriting || rendering || !activeJob) return;
    setRewriting(true);
    setDirectorError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        setAuthOpen(true);
        return;
      }
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brief: activeJob.direction || activeJob.prompt,
          mode: "safe",
          avoid: activeJob.error?.slice(0, 300),
          modality,
          assets: taggedMedia.map((t) => `${t.expand} — ${t.asset.promptFragment ?? t.asset.name}`),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.prompt) throw new Error(data.error ?? "Couldn’t rewrite the prompt");
      setDraftBackup(prompt);
      setPrompt(data.prompt);
      // Same gate as the Generate button — a retry must never spend credits
      // the account doesn't have.
      if (!canAfford) {
        setDirectorError("Prompt rewritten — but you don’t have enough credits to regenerate. Top up and try again.");
        return;
      }
      startGenerate(data.prompt);
    } catch (e) {
      setDirectorError(e instanceof Error ? e.message : "Couldn’t rewrite the prompt");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* The header is the page title; the model is picked in the format bar below. */}
      <h1 className="mb-4 text-center text-xl font-bold tracking-tight">Studio</h1>

      <Card className="overflow-hidden">
        <div className="p-5">
          {/* Look & length */}
          <div className="mb-3.5">
            <h2 className="text-[15px] font-bold tracking-tight text-fg">Model &amp; format</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">The exact model, quality, aspect and length</p>
          </div>
          {/* Locking greys the format out (Edit reopens it) and wakes the rest of the page. */}
          <div className={cn(formatLocked && "pointer-events-none opacity-50")}>
            {/* One card per flavor — picking it sets the model + its default quality. */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {MODEL_CHOICES.map((c) => {
                const m = getModel(c.modelId);
                const on = activeChoice.key === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => {
                      setModelId(c.modelId);
                      setResolution(c.resolution);
                    }}
                    title={m.blurb}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      on
                        ? "border-accent bg-accent-soft shadow-sm"
                        : "border-line hover:-translate-y-0.5 hover:border-line-2",
                    )}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    <span className="mt-0.5 block text-[13px] font-bold text-fg">{c.label}</span>
                    <span className="block min-h-[2.6em] text-[11px] leading-snug text-muted">{c.tagline}</span>
                    <span
                      className={cn(
                        "mt-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        on ? "bg-accent text-white" : "bg-surface-2 text-faint",
                      )}
                    >
                      {on ? resolution : c.resolution} · {videoRate(m, on ? resolution : c.resolution)} cr/s
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2.5">
              {/* Quality lives inside the picked card's world: Mini and Pro each
                  offer their two; 4K is 4K — locked, nothing else to pick. */}
              <div className="flex items-center gap-1.5">
                <span className="mr-1 inline-block w-14 text-[11px] font-semibold uppercase tracking-wide text-faint">Quality</span>
                {activeChoice.qualities.map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    disabled={activeChoice.key === "4k"}
                    title={
                      activeChoice.key === "4k"
                        ? "4K is the whole point of this one"
                        : `${videoRate(model, r)} credits / second`
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      resolution === r
                        ? "border-accent bg-accent-soft text-fg"
                        : "border-line text-muted hover:border-line-2",
                      activeChoice.key === "4k" && "cursor-default",
                    )}
                  >
                    {r}
                    <span className={cn("ml-1 text-[10px]", resolution === r ? "text-accent-2" : "text-faint")}>
                      {videoRate(model, r)}c/s
                    </span>
                  </button>
                ))}
                {activeChoice.key === "4k" && (
                  <span className="text-[11px] text-faint">— locked in, as it should be</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 inline-block w-14 text-[11px] font-semibold uppercase tracking-wide text-faint">Aspect</span>
                {(
                  [
                    // A little frame you can read at a glance: wide, tall, square.
                    { r: "16:9", label: "Wide", frame: "h-[11px] w-[19px]" },
                    { r: "9:16", label: "Tall", frame: "h-[19px] w-[11px]" },
                    { r: "1:1", label: "Square", frame: "h-[15px] w-[15px]" },
                  ] as const
                ).map(({ r, label, frame }) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    title={`${label} · ${r}`}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                      aspectRatio === r
                        ? "border-accent bg-accent-soft text-fg"
                        : "border-line text-muted hover:border-line-2",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-[3px] border-[1.5px]",
                        frame,
                        aspectRatio === r ? "border-accent-2 bg-accent/15" : "border-faint",
                      )}
                    />
                    {r}
                  </button>
                ))}
              </div>
              {modality === "video" && (
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 inline-block w-14 text-[11px] font-semibold uppercase tracking-wide text-faint">Length</span>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDurationSec(d)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                        durationSec === d
                          ? "border-accent bg-accent-soft text-fg"
                          : "border-line text-muted hover:border-line-2",
                      )}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            {!formatLocked && <span className="text-[11.5px] text-faint">Lock it in to continue</span>}
            <Button size="sm" variant="soft" onClick={() => setFormatLocked((v) => !v)}>
              {formatLocked ? (
                <>
                  <Pencil size={13} /> Edit format
                </>
              ) : (
                <>
                  <Lock size={13} /> Lock format
                </>
              )}
            </Button>
          </div>


          {/* Everything after the format sleeps until the format is locked. */}
          <div className={cn(!formatLocked && "pointer-events-none select-none opacity-40")}>
          {/* Cast & assets */}
          <SectionTitle title="Cast & assets" sub="Add characters, products and media" />
          <div>
            {modality === "video" ? (
              <div className="space-y-3.5">
                {/* Storyboard — the whole video boarded as one sheet; its story
                    prompt is guaranteed to ride with the generation. */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                      <LayoutGrid size={12} />
                    </span>
                    <span className="text-[12px] font-semibold text-fg">Storyboard</span>
                    <Link href="/app/storyboard" className="ml-auto text-[11px] font-medium text-accent-2 hover:underline">
                      {storyboards.length ? "Manage" : "Create one"}
                    </Link>
                  </div>
                  {storyboards.length === 0 ? (
                    <Link
                      href="/app/storyboard"
                      className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                    >
                      <LayoutGrid size={14} className="text-accent-2" /> Board the video first — one image of every
                      shot, plus its story prompt
                    </Link>
                  ) : (
                    <>
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {storyboards.map((sb) => {
                          const on = storyboardId === sb.id;
                          return (
                            <button
                              key={sb.id}
                              onClick={() => attachStoryboard(sb)}
                              title={on ? `Detach ${sb.name}` : `Shoot from ${sb.name}`}
                              className={cn(
                                "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                                on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                              )}
                            >
                              <span className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                                <AssetThumb a={sb} className="h-full w-full" />
                                {on && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                                    <Check size={13} />
                                  </span>
                                )}
                              </span>
                              <span className="flex flex-col items-start leading-tight">
                                {sb.name}
                                {sb.promptFragment && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-teal">
                                    <ScrollText size={9} /> story prompt
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {activeStoryboard && (
                        <p className="mt-1 text-[11px] leading-relaxed text-faint">
                          The sheet steers the shot as an image reference, and its story prompt is included in the
                          generation script automatically.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Characters — cast a saved character; fills image + voice slots */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                      <UserRound size={12} />
                    </span>
                    <span className="text-[12px] font-semibold text-fg">Characters</span>
                    <Link href="/app/characters" className="ml-auto text-[11px] font-medium text-accent-2 hover:underline">
                      {characters.length ? "Manage" : "Create one"}
                    </Link>
                  </div>
                  {characters.length === 0 ? (
                    <Link
                      href="/app/characters"
                      className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                    >
                      <UserRound size={14} className="text-accent-2" /> Create a character to cast them in your videos
                    </Link>
                  ) : (
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {characters.map((c) => {
                        const on = board.refs.includes(c.id);
                        const hasVoice = !!voiceForCharacter(c);
                        return (
                          <button
                            key={c.id}
                            onClick={() => castCharacter(c)}
                            title={on ? `Remove ${c.name}` : `Cast ${c.name}`}
                            className={cn(
                              "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                              on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                            )}
                          >
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                              <AssetThumb a={c} className="h-full w-full" />
                              {on && (
                                <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                                  <Check size={13} />
                                </span>
                              )}
                            </span>
                            <span className="flex flex-col items-start leading-tight">
                              {c.name}
                              {hasVoice && (
                                <span className="flex items-center gap-0.5 text-[10px] text-teal">
                                  <Mic size={9} /> voice
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <SlotRow
                  tone="image"
                  icon={<ImageIcon size={12} />}
                  label="Images"
                  count={board.refs.length}
                  cap={REF_IMAGE_LIMIT}
                  dim={!!board.firstFrame}
                >
                  {/* Only filled slots + the next open one — the 0/9 counter says the rest. */}
                  {Array.from({ length: Math.min(REF_IMAGE_LIMIT, refImageAssets.length + 1) }).map((_, i) => (
                    <SlotSquare
                      key={`ri-${i}`}
                      asset={refImageAssets[i] ?? null}
                      tag={`I${i + 1}`}
                      isNext={i === refImageAssets.length}
                      highlight={dragZone === 'refs'}
                      onPress={() => setBoardPickZone('refs')}
                      onRemove={() => refImageAssets[i] && removeFromBoard('refs', refImageAssets[i].id)}
                      {...zoneDropProps('refs')}
                    />
                  ))}
                </SlotRow>

                <SlotRow
                  tone="video"
                  icon={<Film size={12} />}
                  label="Videos"
                  count={board.refVideos.length}
                  cap={REF_VIDEO_LIMIT}
                  dim={!!board.firstFrame}
                >
                  {Array.from({ length: Math.min(REF_VIDEO_LIMIT, refVideoAssets.length + 1) }).map((_, i) => (
                    <SlotSquare
                      key={`rv-${i}`}
                      asset={refVideoAssets[i] ?? null}
                      tag={`V${i + 1}`}
                      wide
                      isNext={i === refVideoAssets.length}
                      highlight={dragZone === 'refVideos'}
                      onPress={() => setBoardPickZone('refVideos')}
                      onRemove={() => refVideoAssets[i] && removeFromBoard('refVideos', refVideoAssets[i].id)}
                      {...zoneDropProps('refVideos')}
                    />
                  ))}
                </SlotRow>

                <SlotRow
                  tone="audio"
                  icon={<Music size={12} />}
                  label="Sound"
                  count={board.influences.length}
                  cap={STYLE_LIMIT}
                >
                  {Array.from({ length: Math.min(STYLE_LIMIT, board.influences.length + 1) }).map((_, i) => {
                    const id = board.influences[i];
                    const a = id ? byId[id] ?? null : null;
                    return (
                      <SlotSquare
                        key={`in-${i}`}
                        asset={a}
                        tag={`A${i + 1}`}
                        isNext={i === board.influences.length}
                        highlight={dragZone === 'influences'}
                        onPress={() => setBoardPickZone('influences')}
                        onRemove={() => id && removeFromBoard('influences', id)}
                        {...zoneDropProps('influences')}
                      />
                    );
                  })}
                </SlotRow>

                <SlotRow
                  tone="image"
                  icon={<ImagePlus size={12} />}
                  label="Start / end frame"
                  count={(board.firstFrame ? 1 : 0) + (board.lastFrame ? 1 : 0)}
                  cap={2}
                  dim={board.refs.length + board.refVideos.length > 0}
                >
                  <SlotSquare
                    asset={board.firstFrame ? byId[board.firstFrame] ?? null : null}
                    tag="F1"
                    wide
                    isNext
                    emptyLabel="F1"
                    highlight={dragZone === 'firstFrame'}
                    onPress={() => setBoardPickZone('firstFrame')}
                    onRemove={() => removeFromBoard('firstFrame')}
                    {...zoneDropProps('firstFrame')}
                  />
                  {/* The end frame only appears once a start frame is set. */}
                  {board.firstFrame && (
                    <SlotSquare
                      asset={board.lastFrame ? byId[board.lastFrame] ?? null : null}
                      tag="F2"
                      wide
                      isNext
                      emptyLabel="F2"
                      highlight={dragZone === 'lastFrame'}
                      onPress={() => setBoardPickZone('lastFrame')}
                      onRemove={() => removeFromBoard('lastFrame')}
                      {...zoneDropProps('lastFrame')}
                    />
                  )}
                </SlotRow>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {orderedClasses.map((key) => (
                  <SlotCard
                    key={key}
                    cls={key}
                    asset={picks[key] ? (byId[picks[key] as string] as Asset) : null}
                    onPick={() => setPickClass(key)}
                    onClear={() => setPick(key, null)}
                  />
                ))}
              </div>
            )}
          </div>


          <SectionTitle
            title="Prompt"
            sub="Write it rough — then clean it up for Seedance, sized to your locked length and referencing everything you added"
          />
          <div>
          {/* Provenance: this session is producing a shot from the production. */}
          {planIdea && (
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="shrink-0 text-accent-2" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                  {shotNumber > 0 && <span className="font-bold">Shot {shotNumber}</span>}
                  {planOfRef?.title || planOfRef?.brief ? (
                    <>
                      {" "}of <span className="font-semibold">{planOfRef.title || planOfRef.brief}</span>
                    </>
                  ) : null}
                  {" — "}
                  {planIdea.title}
                </span>
                <button
                  onClick={() => setPlanRef(null)}
                  className="shrink-0 text-[12px] font-medium text-faint hover:text-fg"
                  title="Detach from the plan"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Provenance: this shot is generated from an attached storyboard. */}
          {activeStoryboard && (
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5">
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="shrink-0 text-accent-2" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                  <span className="font-bold">Storyboard</span> —{" "}
                  <span className="font-semibold">{activeStoryboard.name}</span>: the sheet rides as an image
                  reference and its story prompt is included in the script.
                </span>
                <button
                  onClick={() => attachStoryboard(activeStoryboard)}
                  className="shrink-0 text-[12px] font-medium text-faint hover:text-fg"
                  title="Detach the storyboard"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Script — organized beat view when it has a timeline; textarea to edit. */}
          {(() => {
            const segs = planSegments(prompt);
            const canOrganize = !!segs && segs.length > 1;
            if (canOrganize && !editScript) {
              return (
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                      Script
                    </span>
                    <span className="text-[11px] text-faint">{segs!.length} beats</span>
                    <Button
                      variant="soft"
                      size="sm"
                      className="ml-auto gap-1.5"
                      onClick={() => setEditScript(true)}
                    >
                      <Pencil size={13} /> Edit script
                    </Button>
                  </div>
                  <ScriptBeats segments={segs!} compact />
                </div>
              );
            }
            return (
              <div>
                {canOrganize && (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                      Script
                    </span>
                    <Button
                      variant="soft"
                      size="sm"
                      className="ml-auto gap-1.5"
                      onClick={() => setEditScript(false)}
                    >
                      <Rows3 size={13} /> Organized view
                    </Button>
                  </div>
                )}
                <div className="relative">
                  <textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      const upToCaret = e.target.value.slice(0, e.target.selectionStart ?? 0);
                      const m = upToCaret.match(/#([A-Za-z0-9]*)$/);
                      setTagQuery(m ? m[1] : null);
                    }}
                    onBlur={() => setTimeout(() => setTagQuery(null), 200)}
                    rows={Math.min(16, Math.max(4, Math.ceil(prompt.length / 80)))}
                    placeholder={purpose.placeholder}
                    className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3.5 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-[15px]"
                  />
            {tagQuery !== null && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(16,18,27,0.3)]">
                {taggedMedia.length === 0 ? (
                  <p className="px-2 py-2 text-[12.5px] text-faint">
                    Add media below first — each becomes a tag like <b>#I1</b>, <b>#V1</b>, <b>#A1</b> you can
                    reference here.
                  </p>
                ) : (
                  (() => {
                    const matches = taggedMedia.filter(
                      (t) =>
                        t.tag.toLowerCase().startsWith(tagQuery.toLowerCase()) ||
                        t.asset.name.toLowerCase().includes(tagQuery.toLowerCase()),
                    );
                    if (matches.length === 0) {
                      return (
                        <p className="px-2 py-2 text-[12.5px] text-faint">
                          No tag matches “#{tagQuery}” — your media below is tagged{" "}
                          {taggedMedia.map((t) => `#${t.tag}`).join(", ")}.
                        </p>
                      );
                    }
                    return matches.map((t) => (
                      <button
                        key={t.tag}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const ta = promptRef.current;
                          const caret = ta?.selectionStart ?? prompt.length;
                          const before = prompt.slice(0, caret).replace(/#[A-Za-z0-9]*$/, `#${t.tag} `);
                          const after = prompt.slice(caret);
                          setPrompt(before + after);
                          setTagQuery(null);
                          requestAnimationFrame(() => {
                            ta?.focus();
                            ta?.setSelectionRange(before.length, before.length);
                          });
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                      >
                        <span className="w-8 shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-center text-[11px] font-bold text-accent-2">
                          {t.tag}
                        </span>
                        <AssetThumb a={t.asset} className="h-7 w-7 shrink-0 rounded-md" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{t.asset.name}</span>
                        <span className="hidden max-w-[40%] shrink-0 truncate text-[11px] text-faint sm:block">{t.expand}</span>
                      </button>
                    ));
                  })()
                )}
              </div>
            )}
                </div>
              </div>
            );
          })()}

          {/* The Director — any language in, pro English prompt out */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              variant="soft"
              size="sm"
              disabled={directing || !prompt.trim()}
              onClick={onDirect}
              className="gap-1.5"
            >
              {directing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Cleaning up…
                </>
              ) : (
                <>
                  <Wand2 size={14} /> Clean up for Seedance
                </>
              )}
            </Button>
            {draftBackup && draftBackup !== prompt && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setPrompt(draftBackup);
                  setDraftBackup(null);
                }}
              >
                <Undo2 size={13} /> Undo
              </Button>
            )}
          </div>
          {directorError && <p className="mt-1.5 text-xs text-danger">{directorError}</p>}
          </div>

          {/* Generate */}
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted">Estimated cost</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Coins size={15} className="text-warn" /> {cost} credits
              </span>
            </div>
            {needsSignIn ? (
              <Button size="lg" className="w-full" onClick={() => setAuthOpen(true)}>
                <Sparkles size={18} /> Sign in to generate
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                disabled={rendering || (!locked && !canGenerate)}
                onClick={onGenerate}
              >
                {rendering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Generating…
                  </>
                ) : locked ? (
                  <>
                    <Sparkles size={18} /> Subscribe to generate
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate
                  </>
                )}
              </Button>
            )}
            {!needsSignIn && !locked && hydrated && !canAfford && (
              <p className="mt-2 text-center text-xs text-danger">
                Not enough credits — you need {cost - credits} more. Tap “Buy” in the top bar.
              </p>
            )}
            {needsSignIn && (
              <p className="mt-2 text-center text-xs text-faint">
                Sign in to render with the real VIBVID engine.
              </p>
            )}
          </div>
          </div>
        </div>
      </Card>

      {/* Result */}
      {activeJob && (
        <div ref={resultRef}>
        <Card className="mt-5 p-5">
          <ResultHero job={activeJob} />
          {activeJob.status === "failed" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {classifyGenError(activeJob.error).kind === "policy" && (
                <Button size="sm" disabled={rewriting || rendering || (!locked && !canAfford)} onClick={onRewriteRetry}>
                  {rewriting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Rewriting…
                    </>
                  ) : (
                    <>
                      <Wand2 size={15} /> Rewrite &amp; try again
                    </>
                  )}
                </Button>
              )}
              <Button
                variant={classifyGenError(activeJob.error).kind === "policy" ? "outline" : "primary"}
                size="sm"
                disabled={rewriting || rendering || !canGenerate}
                onClick={onGenerate}
              >
                <RefreshCw size={15} /> Try again
              </Button>
              {directorError && <span className="text-xs text-danger">{directorError}</span>}
            </div>
          )}
          {activeJob.status === "succeeded" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  saveVideoToAssets(activeJob.id);
                  setSavedMsg(true);
                  setTimeout(() => setSavedMsg(false), 2000);
                }}
              >
                {savedMsg ? (
                  <>
                    <Check size={15} className="text-teal" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark size={15} /> Save to Assets
                  </>
                )}
              </Button>
              {activeJob.videoUrl || activeJob.posterUrl ? (
                <a href={activeJob.videoUrl ?? activeJob.posterUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Download size={15} /> Download
                  </Button>
                </a>
              ) : null}
              <Link href="/app/videos" className="ml-auto">
                <Button variant="ghost" size="sm">
                  My Videos <ArrowRight size={15} />
                </Button>
              </Link>
            </div>
          )}
        </Card>
        </div>
      )}

      <SlotPickerModal
        cls={pickClass}
        assets={assets}
        selectedId={pickClass ? picks[pickClass] ?? null : null}
        onSelect={(id) => {
          if (pickClass) setPick(pickClass, id);
          setPickClass(null);
        }}
        onClose={() => setPickClass(null)}
      />

      <BoardPickerModal
        zone={boardPickZone}
        assets={assets}
        board={board}
        onAssign={(zone, id) => {
          assignToZone(zone, id);
          if (zone === "firstFrame" || zone === "lastFrame") setBoardPickZone(null);
        }}
        onRemove={(zone, id) => removeFromBoard(zone, id)}
        onClose={() => setBoardPickZone(null)}
      />
    </div>
  );
}

/* ---------------------------- Shot Board pieces --------------------------- */

function BoardPickerModal({
  zone,
  assets,
  board,
  onAssign,
  onRemove,
  onClose,
}: {
  zone: BoardZone | null;
  assets: Asset[];
  board: Board;
  onAssign: (zone: BoardZone, id: string) => void;
  onRemove: (zone: BoardZone, id: string) => void;
  onClose: () => void;
}) {
  const META: Record<
    BoardZone,
    { title: string; hint: string; kinds: Asset["kind"][]; cap: number; types: string }
  > = {
    firstFrame: {
      title: "First frame · F1",
      hint: "Your video opens exactly on this picture — the scene, the person, the product, frozen at second zero.",
      kinds: ["image"],
      cap: 1,
      types: "JPG · PNG · WebP",
    },
    lastFrame: {
      title: "Last frame · F2",
      hint: "Optional — the video lands on this picture. Perfect for reveals, before → after, and transformations.",
      kinds: ["image"],
      cap: 1,
      types: "JPG · PNG · WebP",
    },
    refs: {
      title: "Reference images · #I1–#I9",
      hint: "The model copies identity, outfits and look from these. Tap to add or remove — up to 9.",
      kinds: ["image"],
      cap: 9,
      types: "JPG · PNG · WebP",
    },
    refVideos: {
      title: "Reference videos · #V1–#V3",
      hint: "Motion and energy for the model to imitate. Tap to add or remove — up to 3.",
      kinds: ["video"],
      cap: 3,
      types: "MP4 · MOV",
    },
    influences: {
      title: "Sound & style · #A1–#A5",
      hint: "Flavors the written prompt only — nothing is uploaded to the model. Up to 5.",
      kinds: ["image", "video", "audio", "prompt"],
      cap: 5,
      types: "Any asset — only its description is used",
    },
  };
  if (!zone) return null;
  const meta = META[zone];
  const single = zone === "firstFrame" || zone === "lastFrame";
  const selected: string[] =
    zone === "firstFrame"
      ? board.firstFrame
        ? [board.firstFrame]
        : []
      : zone === "lastFrame"
        ? board.lastFrame
          ? [board.lastFrame]
          : []
        : zone === "refs"
          ? board.refs
          : zone === "refVideos"
            ? board.refVideos
            : board.influences;
  const options = assets.filter((a) => meta.kinds.includes(a.kind));
  const capReached = selected.length >= meta.cap;

  return (
    <Modal open onClose={onClose} title={meta.title} size="lg">
      <p className="mb-1 text-sm text-muted">{meta.hint}</p>
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
        Accepts: {meta.types}
      </p>
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nothing suitable in your library yet.{" "}
          <Link href="/app/assets" className="text-accent-2 hover:underline" onClick={onClose}>
            Upload something
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {options.map((a) => {
            const isOn = selected.includes(a.id);
            const blocked = !isOn && capReached && !single;
            return (
              <button
                key={a.id}
                onClick={() => {
                  if (single) {
                    onAssign(zone, a.id);
                  } else if (isOn) {
                    onRemove(zone, a.id);
                  } else if (!blocked) {
                    onAssign(zone, a.id);
                  }
                }}
                className={cn(
                  "group overflow-hidden rounded-xl border text-left transition-all",
                  isOn ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-accent/50",
                  blocked && "cursor-not-allowed opacity-40",
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <AssetThumb a={a} className="h-full w-full" />
                  {a.kind === "video" && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 p-0.5 text-white">
                      <Film size={11} />
                    </span>
                  )}
                  {isOn && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {!single && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">
            {selected.length}
            {Number.isFinite(meta.cap) ? ` of ${meta.cap}` : ""} selected
          </span>
          <Button onClick={onClose}>
            <Check size={16} /> Done
          </Button>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------- Slot building blocks -------------------------- */

function SlotCard({
  cls,
  asset,
  onPick,
  onClear,
}: {
  cls: AssetClass;
  asset: Asset | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const meta = CLASS_BY_KEY[cls];
  if (asset) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-2.5">
        <AssetThumb a={asset} className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-accent-2">{meta.label}</div>
          <div className="truncate text-sm font-medium text-fg">{asset.name}</div>
        </div>
        <button onClick={onPick} className="rounded-lg px-2 py-1 text-[12px] font-medium text-muted hover:text-fg">
          Change
        </button>
        <button onClick={onClear} className="rounded-full p-1 text-faint hover:text-fg" aria-label="Remove">
          <X size={15} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl border border-dashed border-line-2 p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-faint">
        <ClassIcon icon={meta.icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{meta.label}</span>
        <span className="block truncate text-[12px] text-faint">{meta.tagline}</span>
      </span>
      <Plus size={16} className="mr-1 text-faint" />
    </button>
  );
}

function SlotPickerModal({
  cls,
  assets,
  selectedId,
  onSelect,
  onClose,
}: {
  cls: AssetClass | null;
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const meta = cls ? CLASS_BY_KEY[cls] : null;
  const options = cls ? assets.filter((a) => a.class === cls) : [];
  return (
    <Modal open={!!cls} onClose={onClose} title={meta ? `Choose a ${meta.label}` : ""} size="lg">
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No {meta?.plural.toLowerCase()} yet.{" "}
          <Link href="/app/assets" className="text-accent-2 hover:underline" onClick={onClose}>
            Upload some
          </Link>{" "}
          to use here.
        </p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {options.map((a) => {
            const active = selectedId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(active ? null : a.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-surface text-left transition-all",
                  active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-2",
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <AssetThumb a={a} className="h-full w-full" />
                  <span className="absolute left-1.5 top-1.5 flex gap-1">
                    <CompositeBadge a={a} />
                    {a.owner === "business" && (
                      <Badge tone="neutral" className="bg-black/55 text-white border-white/20 backdrop-blur-sm">
                        Business
                      </Badge>
                    )}
                  </span>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
