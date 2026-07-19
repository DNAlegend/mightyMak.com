"use client";

// Storyboard — board a whole PRODUCT COMMERCIAL as one image. Give it the
// hero product (a saved Product, or describe one) plus the commercial idea
// and a video length; the Storyboard Artist (Claude) writes two linked
// prompts — the SEEDANCE PROMPT (scene by scene, time ranges summing to the
// length) and a board IMAGE prompt that renders all nine key frames as a
// single 3×3 sheet on Seedream, steered by the product's reference photos.
// A finished board saves itself automatically, and "Use in Studio" feeds the
// sheet in as a reference with the prompt and length preloaded. Boards are
// private: each creator sees only their own sheets and prompts.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  LayoutGrid,
  Loader2,
  Plus,
  Package,
  PenLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import { storyboardDurationSec } from "@/lib/storyboard";
import { clearPendingSheet, getPendingSheet, setPendingSheet } from "@/lib/pending-sheet";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Progress, Segmented } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";

const DURATIONS = [5, 10, 15] as const;

const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";

/** Public https photos of a product composite — the Seedream identity refs. */
function productPhotoUrls(p: Asset): string[] {
  const urls = (p.parts ?? [])
    .filter((x) => x.kind === "image" && /^https:\/\//i.test(x.url))
    .map((x) => x.url);
  return urls.slice(0, 5);
}

export function StoryboardStudio() {
  const router = useRouter();
  /** Gallery first — the creation wizard opens on "Add new". */
  const [creating, setCreating] = useState(false);
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

  const [productId, setProductId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [durationSec, setDurationSec] = useState<number>(10);
  const [title, setTitle] = useState("");
  const [flow, setFlow] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  /** Job ids already auto-saved — a board saves itself exactly once. */
  const savedJobs = useRef<Set<string>>(new Set());
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null);
  /** Saved-board card whose full prompt is expanded. */
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const boards = useMemo(() => assets.filter((a) => a.class === "storyboard"), [assets]);
  const products = useMemo(
    () => assets.filter((a) => a.class === "product" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const product = productId ? products.find((p) => p.id === productId) ?? null : null;
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep buttons clickable so they open the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

  // The sheet renders on the 2K image model — nine legible panels need the detail.
  const model = getModel("seedream-45");
  const cost = priceFor(model, { count: 1, hasRefs: !!product });
  const canAfford = credits >= cost;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";
  const boardUrl = job?.status === "succeeded" ? job.posterUrl : undefined;

  /** The Storyboard Artist: product + idea + length → { title, flow, imagePrompt }. */
  async function onWrite() {
    const idea = brief.trim();
    if ((!idea && !product) || writing) return;
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
        body: JSON.stringify({
          brief: idea || `A premium commercial for ${product!.name}.`,
          durationSec,
          product: product
            ? { name: product.name, look: product.promptFragment ?? "" }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.flow) throw new Error(data.error ?? "The storyboard writer is unavailable");
      setTitle((data.title as string) || product?.name || idea.slice(0, 40));
      setFlow(data.flow as string);
      setImagePrompt(data.imagePrompt as string);
      setJobId(null);
      setSavedAssetId(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "The storyboard writer is unavailable");
    } finally {
      setWriting(false);
    }
  }

  /** Fallback sheet prompt when the creator wrote/edited the flow by hand. */
  const composedImagePrompt =
    imagePrompt.trim() ||
    `A professional product-storyboard sheet: a 3×3 grid of nine vertical frames on a clean white background with thin gutters; each cell carries exactly ONE small grey numeral in its bottom-left corner, numbered in reading order, and no other text anywhere. The nine panels are the key frames of this commercial in story order, the exact same product identical in every panel: ${flow.trim()} Ultra realistic product photography, studio lighting.`;

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
    setSavedAssetId(null);
    const refs = product ? productPhotoUrls(product) : [];
    const id = generate({
      prompt: composedImagePrompt,
      tier: "standard",
      durationSec: 5,
      aspectRatio: "1:1",
      audio: false,
      modelId: model.id,
      modality: "image",
      direction: title.trim() || brief.trim(),
      refImageUrls: refs.length ? refs : undefined,
    });
    setJobId(id);
    // Safety net: if they navigate away mid-render, the next visit restores
    // this state and the auto-save still lands the paid board.
    setPendingSheet("storyboard", {
      jobId: id,
      data: { productId, brief, durationSec, title, flow, imagePrompt },
    });
  }

  // A finished board saves itself: one storyboard asset carrying the sheet,
  // the Seedance prompt and the video length — nothing for the creator to do.
  useEffect(() => {
    if (!job || job.status !== "succeeded" || !job.posterUrl) return;
    if (savedJobs.current.has(job.id)) return;
    savedJobs.current.add(job.id);
    const name = title.trim() || product?.name || brief.trim().slice(0, 40) || "New storyboard";
    const col = addCategory(`${name} — storyboard`);
    const asset = addAsset({
      name,
      kind: "image",
      url: job.posterUrl,
      posterUrl: job.posterUrl,
      categoryId: col.id,
      source: "generation",
      class: "storyboard",
      // The Seedance prompt rides along as the asset's prompt.
      promptFragment: flow.trim(),
      parts: [
        { role: "primary", kind: "image", url: job.posterUrl, posterUrl: job.posterUrl, label: "Storyboard sheet" },
        // The video length, machine-readable for Make.
        { role: "reference", kind: "prompt", url: String(durationSec), label: `Video length: ${durationSec}s` },
      ],
    } as Omit<Asset, "id" | "createdAt">);
    setSavedAssetId(asset.id);
    clearPendingSheet("storyboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.posterUrl]);

  // Restore an in-flight (or finished-but-unsaved) render from a previous
  // visit, so navigating away mid-render never loses the paid board.
  useEffect(() => {
    if (!hydrated || jobId) return;
    const pending = getPendingSheet<{
      productId: string | null;
      brief: string;
      durationSec: number;
      title: string;
      flow: string;
      imagePrompt: string;
    }>("storyboard");
    if (!pending) return;
    const pendingJob = useStore.getState().videos.find((v) => v.id === pending.jobId);
    // Not in the store YET may just mean cloud videos haven't hydrated —
    // keep the marker and try again on the next hydration; only a job we can
    // SEE failed is truly dead.
    if (!pendingJob) return;
    if (pendingJob.status === "failed") {
      clearPendingSheet("storyboard");
      return;
    }
    const d = pending.data;
    setProductId(d.productId);
    setBrief(d.brief);
    setDurationSec(d.durationSec);
    setTitle(d.title);
    setFlow(d.flow);
    setImagePrompt(d.imagePrompt);
    setJobId(pending.jobId);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /** Shoot it: the sheet becomes a reference, the prompt the script, the length the clip. */
  function useInMake(board: Asset) {
    setDraftElements([board.id]);
    if (board.promptFragment) setDraftDirection(board.promptFragment);
    router.push("/app/make");
  }

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      /* clipboard unavailable — the prompt is visible to select manually */
    }
  }

  const canWrite = hydrated && (brief.trim().length > 3 || !!product);
  const canGenerate = hydrated && flow.trim().length > 0 && canAfford;
  const savedBoard = savedAssetId ? boards.find((b) => b.id === savedAssetId) ?? null : null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Storyboard</h1>
        <p className="mt-1 text-sm text-muted">
          Board a product commercial as one image — nine key frames in a grid — plus the detailed
          Seedance prompt that shoots it, sized to your video length. Boards save themselves and
          feed straight into the Studio.
        </p>
      </header>

      {/* Gallery first — the wizard hides behind "Add new". */}
      {!creating && (
        <div className="mb-5">
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus size={17} /> Add new storyboard
          </Button>
        </div>
      )}
      {!creating && boards.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("art-product-reveal"), thumbFor("prod-coffee"), thumbFor("set-desert-highway")]}
          title="No storyboards yet"
          description="Give it your product and the idea — it writes the commercial scene by scene and draws all nine frames as one sheet. Tap “Add new storyboard” to make your first."
        />
      )}

      {/* ------------------------- Saved storyboards ------------------------- */}
      {!creating && boards.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const dur = storyboardDurationSec(b);
            return (
              <Card key={b.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {b.posterUrl || b.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.posterUrl ?? b.url} alt={b.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-faint">
                      <LayoutGrid size={26} />
                    </div>
                  )}
                  {dur && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                        <Clock size={10} /> {dur}s
                      </Badge>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete the "${b.name}" storyboard?`)) removeAsset(b.id);
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete storyboard"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{b.name}</div>
                  {b.promptFragment && (
                    <>
                      <p
                        className={cn(
                          "mt-1 whitespace-pre-wrap text-[11.5px] leading-snug text-faint",
                          openBoard !== b.id && "line-clamp-2",
                        )}
                      >
                        {b.promptFragment}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          onClick={() => setOpenBoard(openBoard === b.id ? null : b.id)}
                          className="text-[11px] font-medium text-accent-2 hover:underline"
                        >
                          {openBoard === b.id ? "Hide the prompt" : "Read the full prompt"}
                        </button>
                        <button
                          onClick={() => copyPrompt(b.id, b.promptFragment!)}
                          className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-fg"
                        >
                          {copiedId === b.id ? (
                            <>
                              <Check size={11} className="text-teal" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                  <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(b)}>
                    <Sparkles size={13} /> Use in Studio
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <>
          <button
            onClick={() => setCreating(false)}
            className="mb-4 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            ← All storyboards
          </button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Brief ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <LayoutGrid size={14} /> New storyboard
          </div>

          {/* The hero product — a saved Product steers the sheet with its photos. */}
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Product <span className="normal-case">(the hero of every frame)</span>
          </label>
          {products.length === 0 ? (
            <button
              onClick={() => router.push("/app/products")}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              <Package size={14} className="text-accent-2" /> Save a product first — or just describe it below
            </button>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {products.map((p) => {
                const on = productId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProductId(on ? null : p.id)}
                    title={on ? `Deselect ${p.name}` : `Star ${p.name}`}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                      on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                    )}
                  >
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {p.posterUrl || p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.posterUrl ?? p.url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={14} className="m-auto text-faint" />
                      )}
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                          <Check size={13} />
                        </span>
                      )}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            The commercial
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="A premium spot for a pink strawberry kefir bottle: macro crown splashes of white kefir, strawberries falling in slow motion, the bottle rising from swirling liquid…"
            className={textareaCls}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Video length
          </label>
          <Segmented<number>
            value={durationSec}
            onChange={setDurationSec}
            options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
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
            The writer directs a {durationSec}-second commercial scene by scene — the Seedance
            prompt — and one prompt that draws its nine key frames as a single 3×3 sheet
            {product ? `, locked to ${product.name}'s photos` : ""}.
          </p>
        </Card>

        {/* ------------------------ Prompt + the sheet ------------------------ */}
        <div className="space-y-4">
          {flow ? (
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                  <PenLine size={14} /> Seedance prompt
                </div>
                <span className="flex items-center gap-1.5">
                  <Badge tone="neutral">
                    <Clock size={10} /> {durationSec}s
                  </Badge>
                  {title && <Badge tone="neutral">{title}</Badge>}
                </span>
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
                <ChevronDown
                  size={13}
                  className={showImagePrompt ? "rotate-180 transition-transform" : "transition-transform"}
                />
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
                <span className="text-muted">Model</span>
                <span className="font-medium">
                  {model.glyph} {model.name}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
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
                Your storyboard appears here — the Seedance prompt written scene by scene, and one
                image holding all nine key frames of the commercial. Finished boards save
                themselves.
              </p>
            </Card>
          )}

          {job && (
            <Card className="overflow-hidden">
              <div className="relative aspect-square w-full bg-surface-2">
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
                    9-panel storyboard · {durationSec}s
                  </Badge>
                </span>
              </div>
            </Card>
          )}

          {!!boardUrl && !rendering && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-teal">
                <Check size={15} /> Saved to your storyboards
              </span>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => savedBoard && useInMake(savedBoard)}
                disabled={!savedBoard}
              >
                Use in Studio <ArrowRight size={15} />
              </Button>
            </Card>
          )}
        </div>
      </div>
        </>
      )}

    </div>
  );
}
