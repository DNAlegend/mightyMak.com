"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronDown,
  X,
  Plus,
  Coins,
  Download,
  Bookmark,
  Check,
  ArrowRight,
  Layers,
  ImagePlus,
  Undo2,
  Film,
  Music,
  Flag,
  Image as ImageIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, listModels, priceFor, DEFAULT_MODEL_ID } from "@/lib/models";
import { ASSET_CLASSES, CLASS_BY_KEY, composeFromAssets } from "@/lib/catalog";
import { PURPOSES, PURPOSE_BY_ID, DEFAULT_PURPOSE_ID } from "@/lib/purposes";
import {
  ASPECT_RATIOS,
  DURATIONS,
  REF_IMAGE_LIMIT,
  REF_VIDEO_LIMIT,
  TIERS,
  type AspectRatio,
  type Asset,
  type AssetClass,
  type Modality,
  type Tier,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Segmented, Toggle, Modal } from "@/components/ui";
import { AssetThumb, ClassIcon, ResultHero, CompositeBadge } from "@/components/shared";

type Picks = Partial<Record<AssetClass, string>>;

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

function InputPanel({
  tone,
  icon,
  title,
  typeLabel,
  count,
  cap,
  hint,
  dim,
  children,
}: {
  tone: keyof typeof INPUT_TONES;
  icon: React.ReactNode;
  title: string;
  typeLabel: string;
  count: number;
  cap: string;
  hint?: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  const t = INPUT_TONES[tone];
  return (
    <div className={cn("rounded-2xl border p-3.5 transition-opacity", t.border, t.bg, dim && "opacity-45")}>
      <div className="mb-2.5 flex items-start gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.chip)}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-fg">{title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", t.pill)}>
              {typeLabel}
            </span>
          </div>
          {hint && <div className="mt-0.5 text-[11.5px] text-faint">{hint}</div>}
        </div>
        <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-muted">
          {count}
          <span className="font-normal text-faint"> / {cap}</span>
        </span>
      </div>
      {children}
    </div>
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

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const initialPurpose = PURPOSE_BY_ID[mode === "image" ? "still" : DEFAULT_PURPOSE_ID];
  const [purposeId, setPurposeId] = useState<string>(initialPurpose.id);
  const [modality, setModality] = useState<Modality>(initialPurpose.modality);
  const [modelId, setModelId] = useState<string>(initialPurpose.modelId || DEFAULT_MODEL_ID);
  const [prompt, setPrompt] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [trayFilter, setTrayFilter] = useState<"all" | AssetClass>("all");
  const [boardPickZone, setBoardPickZone] = useState<BoardZone | null>(null);
  const [dragZone, setDragZone] = useState<BoardZone | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialPurpose.aspectRatio);
  const [durationSec, setDurationSec] = useState<number>(initialPurpose.durationSec);
  const [tier, setTier] = useState<Tier>("standard");
  const [audio, setAudio] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [pickClass, setPickClass] = useState<AssetClass | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [directorError, setDirectorError] = useState<string | null>(null);
  const [draftBackup, setDraftBackup] = useState<string | null>(null);
  /** Open state of the # mention picker: null = closed, else the partial tag. */
  const [tagQuery, setTagQuery] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const cloudUser = useStore((s) => s.cloudUser);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const resultRef = useRef<HTMLDivElement>(null);
  // Real backend configured but visitor not signed in → route them to auth
  // instead of quietly simulating (a sample clip reads as broken generation).
  const needsSignIn = cloudConfigured && !cloudUser;

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
    if (ids.length) {
      if (mode === "image") {
        const seed: Picks = {};
        ids.forEach((id) => {
          const a = byId[id];
          if (a?.class && !seed[a.class]) seed[a.class] = id;
        });
        setPicks((p) => ({ ...seed, ...p }));
      } else {
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
            if (a.kind === "audio") {
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
    setAspectRatio(p.aspectRatio);
    setDurationSec(p.durationSec);
  }

  const purpose = PURPOSE_BY_ID[purposeId] ?? PURPOSE_BY_ID[DEFAULT_PURPOSE_ID];
  // Dedicated generator pages only offer purposes of their modality.
  const availablePurposes = PURPOSES.filter((p) => !mode || p.modality === mode);
  // Surface this purpose's asset classes first; the rest stay available.
  const orderedClasses = [
    ...purpose.classes,
    ...ASSET_CLASSES.map((c) => c.key).filter((k) => !purpose.classes.includes(k)),
  ];

  const heading =
    mode === "image"
      ? { kicker: "Image", h1: "Image generator", sub: "Pick what you're making, type your idea, Generate." }
      : { kicker: "Video", h1: "Video generator", sub: "Pick a model — everything it accepts appears below." };

  const model = getModel(modelId);

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
      expand: `image ${i + 1} (${a.name})`,
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
    if (a.kind === "audio") zone = "influences";
    else if (a.kind === "video" && zone !== "influences") zone = "refVideos";
    if (zone === "firstFrame" || zone === "lastFrame") {
      if (a.kind !== "image") return;
      // Frames mode excludes reference media (API contract).
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
        b.influences.includes(assetId) ? b : { ...b, influences: [...b.influences, assetId] },
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
    const composed = composeFromAssets(pickedAssets, expandedPrompt);
    if (!composed || !purpose.styleSuffix) return composed;
    return `${composed} — ${purpose.styleSuffix}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAssets, expandedPrompt, purpose.styleSuffix]);
  const cost = priceFor(model, { durationSec, count: 1, hasRefs: pickedAssets.length > 0 });
  const canAfford = credits >= cost;
  // `hydrated` also gates the brief window while a signed-in account's cloud
  // state is loading, so a spend can't race the authoritative balance.
  const canGenerate = hydrated && finalPrompt.trim().length > 0 && canAfford;
  const activeJob = videos.find((v) => v.id === activeJobId) ?? null;
  const rendering = activeJob?.status === "rendering";
  const pickedCount = pickedAssets.length;

  function switchModality(m: Modality) {
    // Flipping the toggle on the universal Make page re-anchors the purpose
    // so format and model stay coherent with the chosen modality.
    applyPurpose(m === "image" ? "still" : "custom");
  }

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
          purpose: purpose.id === "custom" ? null : `${purpose.label} — ${purpose.tagline}`,
          assets: taggedMedia.length
            ? taggedMedia.map((t) => `${t.tag} = ${t.asset.promptFragment ?? t.asset.name}`)
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

  function onGenerate() {
    if (!canGenerate || rendering) return;
    const scene = pickedAssets.find((a) => a.class === "scene");
    const posterUrl = (scene ?? pickedAssets[0])?.posterUrl ?? (scene ?? pickedAssets[0])?.url;
    const id = generate({
      prompt: finalPrompt,
      tier,
      durationSec,
      aspectRatio,
      audio,
      modelId,
      modality,
      elements: pickedAssets.map((a) => a.id),
      direction: prompt,
      posterUrl,
      firstFrameUrl: firstFrameUrl ?? undefined,
      lastFrameUrl: firstFrameUrl ? lastFrameUrl ?? undefined : undefined,
      refImageUrls: refImageUrls.length ? refImageUrls : undefined,
      refVideoUrls: refVideoUrls.length ? refVideoUrls : undefined,
    });
    setActiveJobId(id);
    setSavedMsg(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 text-center">
        <div className="mb-1.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
          <Sparkles size={14} /> {heading.kicker}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading.h1}</h1>
        <p className="mt-1.5 text-sm text-muted">{heading.sub}</p>
      </header>

      {/* Purpose picker (image page only — video is model-first) */}
      {mode === "image" && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1.5">
          {availablePurposes.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPurpose(p.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                purposeId === p.id
                  ? "border-accent/60 bg-accent-soft"
                  : "border-line bg-surface hover:border-line-2",
              )}
            >
              <span className="text-lg leading-none">{p.glyph}</span>
              <span>
                <span className="block text-[13px] font-semibold leading-tight text-fg">{p.label}</span>
                <span className="block text-[11px] leading-tight text-faint">{p.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* The model — the very first choice; its inputs render below */}
      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {listModels({ modality, enabledOnly: true }).map((m) => (
          <button
            key={m.id}
            onClick={() => setModelId(m.id)}
            className={cn(
              "rounded-2xl border p-3.5 text-left transition-all",
              modelId === m.id
                ? "border-accent/60 bg-accent-soft shadow-[0_10px_28px_-16px_rgba(124,108,255,0.5)]"
                : "border-line bg-surface hover:border-line-2",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{m.glyph}</span>
              <span className="text-[14px] font-semibold text-fg">{m.name}</span>
              {m.badge && (
                <Badge tone={m.badge === "recommended" ? "accent" : "neutral"} className="ml-auto capitalize">
                  {m.badge}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{m.blurb}</p>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="p-5">
          {/* Prompt — type # to reference added media by tag */}
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
              rows={3}
              placeholder={purpose.placeholder}
              className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3.5 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {tagQuery !== null && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(16,18,27,0.3)]">
                {taggedMedia.length === 0 ? (
                  <p className="px-2 py-2 text-[12.5px] text-faint">
                    Add media below first — each becomes a tag like <b>#I1</b>, <b>#V1</b>, <b>#A1</b> you can
                    reference here.
                  </p>
                ) : (
                  taggedMedia
                    .filter(
                      (t) =>
                        t.tag.toLowerCase().startsWith(tagQuery.toLowerCase()) ||
                        t.asset.name.toLowerCase().includes(tagQuery.toLowerCase()),
                    )
                    .map((t) => (
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
                        <span className="truncate text-[13px] text-fg">{t.asset.name}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-faint">{t.expand}</span>
                      </button>
                    ))
                )}
              </div>
            )}
          </div>

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
                  <Loader2 size={14} className="animate-spin" /> Improving…
                </>
              ) : (
                <>
                  <Wand2 size={14} /> Improve prompt
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
            <span className="text-[11.5px] text-faint">Any language — عربي · 中文 · English</span>
          </div>
          {directorError && <p className="mt-1.5 text-xs text-danger">{directorError}</p>}

          {/* Try-this chips */}
          {!prompt && pickedCount === 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-faint">
                <Wand2 size={12} /> Try
              </span>
              {purpose.ideas.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setPrompt(idea)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  {idea.length > 38 ? idea.slice(0, 38) + "…" : idea}
                </button>
              ))}
            </div>
          )}

          {/* Inputs this model accepts — always visible, empty until filled */}
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
              {getModel(modelId).name} inputs
            </div>
            <p className="mb-3 text-[11.5px] text-faint">
              {modality === "video"
                ? `Text prompt — plus exact frames (first ± last) OR references (up to ${REF_IMAGE_LIMIT} images + ${REF_VIDEO_LIMIT} videos). Drag from the tray or press +. Added media get tags (#I1, #V1…) — type # in the prompt to reference them.`
                : "Text prompt — the pickers below just help you write it."}
            </p>

            {modality === "video" && (
              <div className="mt-3 space-y-4">
                {/* Asset tray — drag from here */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {(["all", ...ASSET_CLASSES.map((c) => c.key)] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setTrayFilter(k as "all" | AssetClass)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                          trayFilter === k
                            ? "border-accent/60 bg-accent-soft text-fg"
                            : "border-line text-faint hover:text-fg",
                        )}
                      >
                        {k === "all" ? "All" : CLASS_BY_KEY[k as AssetClass].plural}
                      </button>
                    ))}
                  </div>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5">
                    {assets
                      .filter((a) => trayFilter === "all" || a.class === trayFilter)
                      .map((a) => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                          onClick={() => assignToZone("refs", a.id)}
                          title="Drag into a spot, or tap to add as a reference"
                          className={cn(
                            "flex shrink-0 cursor-grab items-center gap-1.5 rounded-xl border py-1.5 pl-1.5 pr-2.5 text-[12px] font-medium transition-colors active:cursor-grabbing",
                            boardIds.includes(a.id)
                              ? "border-accent/50 bg-accent-soft text-fg"
                              : "border-line bg-surface text-muted hover:border-line-2",
                          )}
                        >
                          <AssetThumb a={a} className="h-8 w-8 rounded-lg" />
                          <span className="max-w-[90px] truncate">{a.name}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Frames — image area for exact start/end */}
                <InputPanel
                  tone="image"
                  icon={<ImagePlus size={16} />}
                  title="Start & end frames"
                  typeLabel="Images"
                  count={(board.firstFrame ? 1 : 0) + (board.lastFrame ? 1 : 0)}
                  cap="2"
                  hint="The exact first — and optionally last — picture of your clip."
                  dim={board.refs.length + board.refVideos.length > 0}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-fg">
                        <ImagePlus size={13} className="text-accent-2" /> First frame · F1
                      </div>
                      <p className="mb-1.5 text-[11px] leading-snug text-faint">
                        Your video opens exactly on this picture — the scene, the person, the
                        product, frozen at second zero.
                      </p>
                      <DropSquare
                        label={board.firstFrame ? "F1 · First frame" : "First frame"}
                        icon={<ImagePlus size={17} />}
                        asset={board.firstFrame ? byId[board.firstFrame] : null}
                        highlight={dragZone === "firstFrame"}
                        onClear={() => removeFromBoard("firstFrame")}
                        onPick={() => setBoardPickZone("firstFrame")}
                        {...zoneDropProps("firstFrame")}
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-fg">
                        <Flag size={13} className="text-accent-2" /> Last frame · F2
                      </div>
                      <p className="mb-1.5 text-[11px] leading-snug text-faint">
                        Optional — the video lands on this picture. Perfect for reveals,
                        before → after, and transformations.
                      </p>
                      <DropSquare
                        label={board.lastFrame ? "F2 · Last frame" : "Last frame"}
                        icon={<Flag size={17} />}
                        asset={board.lastFrame ? byId[board.lastFrame] : null}
                        disabled={!board.firstFrame}
                        hint={!board.firstFrame ? "needs a first frame" : undefined}
                        highlight={dragZone === "lastFrame"}
                        onClear={() => removeFromBoard("lastFrame")}
                        onPick={() => setBoardPickZone("lastFrame")}
                        {...zoneDropProps("lastFrame")}
                      />
                    </div>
                  </div>
                </InputPanel>

                {/* Reference images — image area */}
                <InputPanel
                  tone="image"
                  icon={<ImageIcon size={16} />}
                  title="Reference images"
                  typeLabel="Images"
                  count={board.refs.length}
                  cap={String(REF_IMAGE_LIMIT)}
                  hint="The model copies identity, outfits and look from these."
                  dim={!!board.firstFrame}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: REF_IMAGE_LIMIT }).map((_, i) => {
                      const a = refImageAssets[i];
                      if (a) {
                        return (
                          <div key={a.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-accent/50">
                            <AssetThumb a={a} className="h-full w-full" />
                            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/65 px-1 text-[9px] font-bold text-white">
                              I{i + 1}
                            </span>
                            <button
                              onClick={() => removeFromBoard("refs", a.id)}
                              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                              aria-label="Remove reference"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      }
                      const isNext = i === refImageAssets.length;
                      return (
                        <button
                          key={`empty-${i}`}
                          onClick={() => setBoardPickZone("refs")}
                          {...zoneDropProps("refs")}
                          className={cn(
                            "flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed text-faint transition-colors",
                            isNext
                              ? "border-line-2 hover:border-accent/40 hover:text-fg"
                              : "border-line opacity-45",
                            dragZone === "refs" && isNext && "border-accent bg-accent-soft",
                          )}
                        >
                          {isNext ? (
                            <Plus size={15} />
                          ) : (
                            <span className="flex flex-col items-center gap-0.5">
                              <ImageIcon size={12} />
                              <span className="text-[9px]">{i + 1}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </InputPanel>

                {/* Reference videos — video area */}
                <InputPanel
                  tone="video"
                  icon={<Film size={16} />}
                  title="Reference videos"
                  typeLabel="Videos"
                  count={board.refVideos.length}
                  cap={String(REF_VIDEO_LIMIT)}
                  hint="Motion and energy for the model to imitate."
                  dim={!!board.firstFrame}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: REF_VIDEO_LIMIT }).map((_, i) => {
                      const a = refVideoAssets[i];
                      if (a) {
                        return (
                          <div key={a.id} className="relative h-16 w-28 overflow-hidden rounded-lg border border-teal/60">
                            <AssetThumb a={a} className="h-full w-full" />
                            <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold text-white">
                              <Film size={9} /> V{i + 1}
                            </span>
                            <button
                              onClick={() => removeFromBoard("refVideos", a.id)}
                              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                              aria-label="Remove reference video"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      }
                      const isNext = i === refVideoAssets.length;
                      return (
                        <button
                          key={`emptyv-${i}`}
                          onClick={() => setBoardPickZone("refVideos")}
                          {...zoneDropProps("refVideos")}
                          className={cn(
                            "flex h-16 w-28 items-center justify-center gap-1 rounded-lg border-2 border-dashed text-faint transition-colors",
                            isNext
                              ? "border-line-2 hover:border-accent/40 hover:text-fg"
                              : "border-line opacity-45",
                            dragZone === "refVideos" && isNext && "border-accent bg-accent-soft",
                          )}
                        >
                          <Film size={13} />
                          {isNext && <Plus size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </InputPanel>

                {/* Sound & style — audio area (prompt-only) */}
                <InputPanel
                  tone="audio"
                  icon={<Music size={16} />}
                  title="Sound & style"
                  typeLabel="Audio · Any"
                  count={board.influences.length}
                  cap="∞"
                  hint="Flavors the written prompt only — nothing is uploaded."
                >
                  <div
                    className={cn(
                      "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-xl border border-dashed p-1.5",
                      dragZone === "influences" ? "border-accent bg-accent-soft" : "border-line",
                    )}
                    {...zoneDropProps("influences")}
                  >
                    {board.influences.length === 0 && (
                      <span className="px-1.5 text-[11.5px] text-faint">
                        Drop audio, dances or anything here to flavor the prompt
                      </span>
                    )}
                    {board.influences.map((id, i) => {
                      const a = byId[id];
                      if (!a) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-1 pr-1.5 text-[12px]"
                        >
                          <span className="rounded bg-warn/20 px-1 text-[9px] font-bold text-warn">A{i + 1}</span>
                          <AssetThumb a={a} className="h-5 w-5 rounded-full" />
                          {a.name}
                          <button onClick={() => removeFromBoard("influences", id)} className="text-faint hover:text-fg">
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </InputPanel>

                <p className="text-[11px] text-faint">
                  Exact frames and references can&apos;t be combined — filling one clears the other.
                </p>
              </div>
            )}

            {modality === "image" && (
              <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

            {pickedCount > 0 && finalPrompt && (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                  What the model will be told
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{finalPrompt}</p>
              </div>
            )}
          </div>

          {/* Model & options (disclosed; the purpose already set sane defaults) */}
          <div className="mt-4 border-t border-line pt-4">
            <button
              onClick={() => setShowOptions((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ChevronDown size={15} className={cn("transition-transform", showOptions && "rotate-180")} /> Options
              <span className="ml-auto text-[12px] font-normal text-faint">
                {getModel(modelId).name} · {aspectRatio}
                {modality === "video" ? ` · ${durationSec}s` : ""}
              </span>
            </button>

            {showOptions && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">Aspect</label>
                    <Segmented<AspectRatio>
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
                    />
                  </div>
                  {modality === "video" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Duration</label>
                      <Segmented<number>
                        value={durationSec}
                        onChange={setDurationSec}
                        options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                      />
                    </div>
                  )}
                </div>
                {modality === "video" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Quality</label>
                      <Segmented<Tier>
                        value={tier}
                        onChange={setTier}
                        options={(Object.keys(TIERS) as Tier[]).map((t) => ({
                          value: t,
                          label: TIERS[t].label,
                          hint: `${TIERS[t].resolution} · ${TIERS[t].creditsPerSec}/s`,
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                      <span className="text-sm font-medium text-fg">Native audio</span>
                      <Toggle checked={audio} onChange={setAudio} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Generate */}
          <div className="mt-5 border-t border-line pt-4">
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
              <Button size="lg" className="w-full" disabled={!canGenerate || rendering} onClick={onGenerate}>
                {rendering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate
                  </>
                )}
              </Button>
            )}
            {!needsSignIn && hydrated && !canAfford && (
              <p className="mt-2 text-center text-xs text-danger">
                Not enough credits — you need {cost - credits} more. Tap “Buy” in the top bar.
              </p>
            )}
            {needsSignIn && (
              <p className="mt-2 text-center text-xs text-faint">
                Free account · 1,200 credits to start — your shot renders with the real{" "}
                {modality === "video" ? "Seedance" : "Seedream"} model.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Result */}
      {activeJob && (
        <div ref={resultRef}>
        <Card className="mt-5 p-5">
          <ResultHero job={activeJob} />
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
              <Link href="/app/library" className="ml-auto">
                <Button variant="ghost" size="sm">
                  Library <ArrowRight size={15} />
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
        onSelect={(id) => {
          if (boardPickZone) assignToZone(boardPickZone, id);
          setBoardPickZone(null);
        }}
        onClose={() => setBoardPickZone(null)}
      />
    </div>
  );
}

/* ---------------------------- Shot Board pieces --------------------------- */

function DropSquare({
  label,
  hint,
  icon,
  asset,
  disabled,
  highlight,
  onPick,
  onClear,
  ...dropProps
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  asset: Asset | null | undefined;
  disabled?: boolean;
  highlight?: boolean;
  onPick: () => void;
  onClear: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...(disabled ? {} : dropProps)}
      className={cn(
        "relative aspect-video overflow-hidden rounded-xl border-2 transition-colors",
        asset ? "border-solid border-accent/50" : "border-dashed border-line-2",
        highlight && !disabled && "border-accent bg-accent-soft",
        disabled && "opacity-45",
      )}
    >
      {asset ? (
        <>
          <AssetThumb a={asset} className="h-full w-full" />
          <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {label}
          </span>
          <button
            onClick={onClear}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
            aria-label={`Clear ${label}`}
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <button
          onClick={onPick}
          disabled={disabled}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint transition-colors hover:text-fg disabled:cursor-not-allowed"
        >
          {icon}
          <span className="text-[11px] font-semibold">{label}</span>
          {hint && <span className="text-[10px]">{hint}</span>}
        </button>
      )}
    </div>
  );
}

function BoardPickerModal({
  zone,
  assets,
  onSelect,
  onClose,
}: {
  zone: BoardZone | null;
  assets: Asset[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const titles: Record<BoardZone, string> = {
    firstFrame: "Choose the first frame (image)",
    lastFrame: "Choose the last frame (image)",
    refs: "Add a reference image",
    refVideos: "Add a reference video",
    influences: "Add a style influence",
  };
  const options = zone
    ? assets.filter((a) =>
        zone === "refVideos"
          ? a.kind === "video"
          : zone === "influences"
            ? true
            : a.kind === "image",
      )
    : [];
  return (
    <Modal open={!!zone} onClose={onClose} title={zone ? titles[zone] : ""} size="lg">
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nothing suitable in your library yet.{" "}
          <Link href="/app/assets" className="text-accent-2 hover:underline" onClick={onClose}>
            Upload something
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {options.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className="group overflow-hidden rounded-xl border border-line bg-surface text-left transition-all hover:border-accent/50"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <AssetThumb a={a} className="h-full w-full" />
                {a.kind === "video" && (
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 p-0.5 text-white">
                    <Film size={11} />
                  </span>
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
              </div>
            </button>
          ))}
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
