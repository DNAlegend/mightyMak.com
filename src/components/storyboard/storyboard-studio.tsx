"use client";

// Storyboard — plan a whole video as ONE image. The Storyboard Artist
// (Claude) writes two linked prompts from a brief: the STORY FLOW (how the
// video plays, panel by panel, start to finish) and a board IMAGE prompt
// that renders every panel as a single grid sheet on Seedream. Both save to
// the library as one storyboard asset — the sheet is the picture, the flow
// rides along as its prompt — and "Use in Make" feeds the sheet in as a
// reference image with the flow prefilled as the script.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Coins,
  LayoutGrid,
  Loader2,
  PenLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import type { Asset, AspectRatio } from "@/lib/types";
import { Badge, Button, Card, Progress, Segmented } from "@/components/ui";

type StyleKey = "cinematic" | "photoreal" | "anime" | "sketch";

const STYLES: Record<StyleKey, { label: string; suffix: string }> = {
  cinematic: { label: "Cinematic", suffix: "cinematic film stills, dramatic lighting, rich color grade" },
  photoreal: { label: "Photoreal", suffix: "photorealistic frames, natural light, documentary realism" },
  anime: { label: "Anime", suffix: "high-quality anime keyframes, clean lineart, cel shading" },
  sketch: { label: "Sketch", suffix: "hand-drawn pencil storyboard sketches, loose expressive linework, grey shading" },
};

/** Panel counts the board offers, with the sheet ratio each grid fits best. */
const PANEL_OPTIONS: Record<number, { grid: string; aspectRatio: AspectRatio }> = {
  4: { grid: "2×2", aspectRatio: "1:1" },
  6: { grid: "3×2", aspectRatio: "16:9" },
  9: { grid: "3×3", aspectRatio: "1:1" },
};

const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";

export function StoryboardStudio() {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const removeAsset = useStore((s) => s.removeAsset);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [brief, setBrief] = useState("");
  const [panels, setPanels] = useState<number>(9);
  const [style, setStyle] = useState<StyleKey>("cinematic");
  const [title, setTitle] = useState("");
  const [flow, setFlow] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const boards = useMemo(() => assets.filter((a) => a.class === "storyboard"), [assets]);
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep buttons clickable so they open the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

  // The sheet renders on the 2K image model — nine legible panels need the detail.
  const model = getModel("seedream-45");
  const cost = priceFor(model, { count: 1 });
  const canAfford = credits >= cost;
  const aspectRatio = PANEL_OPTIONS[panels].aspectRatio;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";
  const boardUrl = job?.status === "succeeded" ? job.posterUrl : undefined;

  /** The Storyboard Artist: brief → { title, flow, imagePrompt }. */
  async function onWrite() {
    const idea = brief.trim();
    if (!idea || writing) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    // Browsing is free; the writer isn't — prompt subscribe if locked.
    if (useStore.getState().blockIfLocked()) return;
    setWriting(true);
    setWriteError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in first");
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief: idea, panels, style: STYLES[style].suffix }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.flow) throw new Error(data.error ?? "The storyboard writer is unavailable");
      setTitle((data.title as string) || idea.slice(0, 40));
      setFlow(data.flow as string);
      setImagePrompt(data.imagePrompt as string);
      setJobId(null);
      setSaved(false);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "The storyboard writer is unavailable");
    } finally {
      setWriting(false);
    }
  }

  /** Fallback sheet prompt when the creator wrote/edited the flow by hand. */
  const composedImagePrompt =
    imagePrompt.trim() ||
    `A professional film storyboard sheet: a ${PANEL_OPTIONS[panels].grid} grid of ${panels} numbered panels on a clean white background with thin gutters, a small panel number in the corner of each cell. The panels tell this story in order, one beat per panel, the same protagonist identical in every panel — same face, hair and wardrobe: ${flow.trim()} Rendered as ${STYLES[style].suffix}.`;

  function onGenerate() {
    if (rendering) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    if (locked) {
      useStore.getState().blockIfLocked(); // opens the subscribe paywall
      return;
    }
    if (!flow.trim() || !canAfford) return;
    setSaved(false);
    setJobId(
      generate({
        prompt: composedImagePrompt,
        tier: "standard",
        durationSec: 5,
        aspectRatio,
        audio: false,
        modelId: model.id,
        modality: "image",
        direction: title.trim() || brief.trim(),
      }),
    );
  }

  /** One storyboard = one asset: the sheet is the picture, the flow its prompt. */
  function onSave() {
    if (!boardUrl) return;
    const name = title.trim() || brief.trim().slice(0, 40) || "New storyboard";
    const col = addCategory(`${name} — storyboard`);
    addAsset({
      name,
      kind: "image",
      url: boardUrl,
      posterUrl: boardUrl,
      categoryId: col.id,
      source: "generation",
      class: "storyboard",
      // The flow rides along as the asset's prompt — Make and the Director read it.
      promptFragment: flow.trim(),
      parts: [{ role: "primary", kind: "image", url: boardUrl, posterUrl: boardUrl, label: "Storyboard sheet" }],
    } as Omit<Asset, "id" | "createdAt">);
    setSaved(true);
  }

  /** Shoot it: the sheet becomes a reference image, the flow the script. */
  function useInMake(board: Asset) {
    setDraftElements([board.id]);
    if (board.promptFragment) setDraftDirection(board.promptFragment);
    router.push("/app/make");
  }

  const canWrite = hydrated && brief.trim().length > 3;
  const canGenerate = hydrated && flow.trim().length > 0 && canAfford;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Storyboard</h1>
        <p className="mt-1 text-sm text-muted">
          Turn an idea into a one-image storyboard — every beat of the video in a single grid —
          plus the detailed story-flow prompt that drives it. Save both, then feed them straight
          into Make.
        </p>
      </header>

      {/* ------------------------- Saved storyboards ------------------------- */}
      {boards.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Card key={b.id} className="group overflow-hidden">
              <div className="relative aspect-video bg-surface-2">
                {b.posterUrl || b.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.posterUrl ?? b.url} alt={b.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-faint">
                    <LayoutGrid size={26} />
                  </div>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Delete the "${b.name}" storyboard?`)) removeAsset(b.id);
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
                  aria-label="Delete storyboard"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="p-3">
                <div className="truncate text-[13.5px] font-semibold">{b.name}</div>
                {b.promptFragment && (
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-faint">{b.promptFragment}</p>
                )}
                <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(b)}>
                  <Sparkles size={13} /> Use in Make
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Brief ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <LayoutGrid size={14} /> New storyboard
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            What's the video?
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="A barista's morning: opening the café before dawn, the first espresso pour, the rush, one quiet smile at closing…"
            className={textareaCls}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Panels
          </label>
          <Segmented<number>
            value={panels}
            onChange={setPanels}
            options={Object.keys(PANEL_OPTIONS).map((k) => ({
              value: Number(k),
              label: `${k} · ${PANEL_OPTIONS[Number(k)].grid}`,
            }))}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Style</label>
          <Segmented<StyleKey>
            value={style}
            onChange={setStyle}
            options={(Object.keys(STYLES) as StyleKey[]).map((k) => ({ value: k, label: STYLES[k].label }))}
          />

          {needsSignIn ? (
            <Button size="lg" className="mt-5 w-full" onClick={() => setAuthOpen(true)}>
              <PenLine size={17} /> Sign in to write
            </Button>
          ) : (
            <Button size="lg" className="mt-5 w-full" disabled={writing || (!locked && !canWrite)} onClick={onWrite}>
              {writing ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Writing the board…
                </>
              ) : locked ? (
                <>
                  <PenLine size={17} /> Subscribe to write
                </>
              ) : flow ? (
                <>
                  <PenLine size={17} /> Rewrite storyboard
                </>
              ) : (
                <>
                  <PenLine size={17} /> Write storyboard
                </>
              )}
            </Button>
          )}
          {writeError && <p className="mt-2 text-xs text-danger">{writeError}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            The writer directs your idea into {panels} beats — the story flow — and one prompt
            that draws all of them as a single {PANEL_OPTIONS[panels].grid} sheet.
          </p>
        </Card>

        {/* ------------------------- Flow + the sheet ------------------------- */}
        <div className="space-y-4">
          {flow ? (
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                  <PenLine size={14} /> Story flow
                </div>
                {title && <Badge tone="neutral">{title}</Badge>}
              </div>
              <textarea
                value={flow}
                onChange={(e) => setFlow(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <button
                onClick={() => setShowImagePrompt((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
              >
                <ChevronDown size={13} className={showImagePrompt ? "rotate-180 transition-transform" : "transition-transform"} />
                Board image prompt
              </button>
              {showImagePrompt && (
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={6}
                  placeholder="How the sheet itself is drawn — filled in by the writer, editable here."
                  className={`${textareaCls} mt-2`}
                />
              )}

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">Board render cost</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Coins size={15} className="text-warn" /> {cost} credits
                </span>
              </div>
              <Button
                size="lg"
                className="mt-3 w-full"
                disabled={rendering || (!locked && !canGenerate)}
                onClick={onGenerate}
              >
                {rendering ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Drawing the board…
                  </>
                ) : locked ? (
                  <>
                    <Sparkles size={17} /> Subscribe to generate
                  </>
                ) : boardUrl ? (
                  <>
                    <Sparkles size={17} /> Redraw storyboard
                  </>
                ) : (
                  <>
                    <Sparkles size={17} /> Generate storyboard
                  </>
                )}
              </Button>
              {hydrated && !needsSignIn && !locked && !canAfford && (
                <p className="mt-2 text-center text-xs text-danger">
                  Not enough credits — you need {cost - credits} more.
                </p>
              )}
            </Card>
          ) : (
            <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <LayoutGrid size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your storyboard appears here — the story flow written beat by beat, and one image
                holding every panel of the video from its first frame to its last.
              </p>
            </Card>
          )}

          {job && (
            <Card className="overflow-hidden">
              <div
                className="relative w-full bg-surface-2"
                style={{ aspectRatio: aspectRatio === "16:9" ? "16 / 9" : "1 / 1" }}
              >
                {job.status === "rendering" ? (
                  <div className="shimmer flex h-full flex-col items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-accent-2" />
                    <div className="mt-3 w-32">
                      <Progress value={job.progress} />
                    </div>
                  </div>
                ) : boardUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={boardUrl} alt="Storyboard sheet" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-xs text-danger">
                    {job.error ?? "Failed"}
                  </div>
                )}
                <span className="absolute left-2 top-2">
                  <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                    {panels}-panel storyboard
                  </Badge>
                </span>
              </div>
            </Card>
          )}

          {!!boardUrl && !rendering && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <Button onClick={onSave} disabled={saved}>
                {saved ? (
                  <>
                    <Check size={16} className="text-teal" /> Saved to Storyboards
                  </>
                ) : (
                  <>
                    <Bookmark size={16} /> Save storyboard
                  </>
                )}
              </Button>
              {saved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    const b = boards.find((x) => x.url === boardUrl);
                    if (b) useInMake(b);
                  }}
                >
                  Use in Make <ArrowRight size={15} />
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
