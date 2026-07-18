"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Play,
  Sparkles,
  Loader2,
  Trash2,
  Download,
  Bookmark,
  Repeat2,
  Check,
  Copy,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getModel } from "@/lib/models";
import { TIERS, type Asset, type VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState, Modal, Progress } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";
import {
  AssetThumb,
  VideoPreview,
  classifyGenError,
  genErrorReason,
  safeRewritePrompt,
} from "@/components/shared";

export function LibraryView() {
  const allJobs = useStore((s) => s.videos);
  const hydrated = useStore((s) => s.hasHydrated);
  const [openId, setOpenId] = useState<string | null>(null);

  // Videos only — the product doesn't produce images for now.
  const videos = useMemo(() => allJobs.filter((v) => (v.modality ?? "video") === "video"), [allJobs]);
  const open = videos.find((v) => v.id === openId) ?? null;
  const done = videos.filter((v) => v.status === "succeeded").length;
  const failed = videos.filter((v) => v.status === "failed").length;
  const rendering = videos.filter((v) => v.status === "rendering").length;

  // Deep link: /app/videos?open=<jobId> — only open finished videos (a
  // rendering/failed job in the player modal is just a black box).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    window.history.replaceState({}, "", window.location.pathname);
    const v = useStore.getState().videos.find((x) => x.id === id);
    if (v?.status === "succeeded") setOpenId(id);
  }, []);

  if (!hydrated) return <GridSkeleton />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Videos</h1>
          <p className="mt-1 text-sm text-muted">
            {videos.length === 0
              ? "Every video you generate is collected and managed here."
              : `${done} ${done === 1 ? "video" : "videos"} generated${
                  rendering > 0 ? ` · ${rendering} rendering…` : ""
                }${failed > 0 ? ` · ${failed} failed` : ""}.`}
          </p>
        </div>
        <Button onClick={() => (window.location.href = "/app")} className="hidden sm:inline-flex">
          <Sparkles size={16} /> Open the Studio
        </Button>
      </header>

      {videos.length === 0 ? (
        <EmptyState
          icon={<Film size={24} />}
          art={[thumbFor("set-neon-tokyo"), thumbFor("cast-neon-samurai"), thumbFor("set-cloud-temple")]}
          title="Nothing here yet"
          description="Generate in the Studio and your videos land here — each one keeping the prompt and media it was produced from."
          action={
            <Button onClick={() => (window.location.href = "/app")}>
              <Sparkles size={16} /> Open the Studio
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <ContentCard key={v.id} video={v} onOpen={() => v.status === "succeeded" && setOpenId(v.id)} />
          ))}
        </div>
      )}

      <ContentModal video={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ContentCard({ video, onOpen }: { video: VideoJob; onOpen: () => void }) {
  const router = useRouter();
  const removeVideo = useStore((s) => s.removeVideo);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const updateIdeaPrompt = useStore((s) => s.updateIdeaPrompt);
  const [fixing, setFixing] = useState(false);
  const rendering = video.status === "rendering";
  const failed = video.status === "failed";
  const model = getModel(video.modelId);
  const failInfo = failed ? classifyGenError(video.error) : null;
  return (
    <Card className="group overflow-hidden">
      <button
        onClick={onOpen}
        disabled={rendering || failed}
        className="relative block aspect-video w-full overflow-hidden bg-surface-2"
      >
        {rendering ? (
          <div className="shimmer flex h-full flex-col items-center justify-center">
            <Loader2 size={22} className="animate-spin text-accent-2" />
            <div className="mt-3 w-32">
              <Progress value={video.progress} />
            </div>
            <span className="mt-1.5 text-xs tabular-nums text-faint">{video.progress}%</span>
          </div>
        ) : failed ? (
          // Say it plainly: this one didn't make it — and exactly why.
          <div className="flex h-full flex-col items-center justify-center gap-1.5 border-b-2 border-danger/40 bg-danger/5 px-5 text-center">
            <AlertTriangle size={20} className="text-danger" />
            <span className="text-[13.5px] font-semibold text-fg">{failInfo!.title}</span>
            <span className="line-clamp-2 text-[12px] leading-snug text-muted">{failInfo!.detail}</span>
            {genErrorReason(video.error) && (
              <span
                className="max-w-full truncate font-mono text-[10.5px] text-faint"
                title={genErrorReason(video.error)}
              >
                {genErrorReason(video.error)}
              </span>
            )}
          </div>
        ) : (
          <>
            {video.videoUrl ? (
              // Proper preview: a real frame from the clip, playing on hover.
              <VideoPreview
                src={video.videoUrl}
                poster={video.posterUrl}
                className="h-full w-full"
              />
            ) : video.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.posterUrl} alt={video.prompt} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-faint">
                <Film size={26} />
              </div>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                <Play size={18} className="ml-0.5 text-black" fill="black" />
              </span>
            </span>
            <span className="absolute bottom-2 right-2">
              <Badge tone="neutral" className="bg-black/60 text-white border-white/20 backdrop-blur-sm">
                {video.durationSec}s
              </Badge>
            </span>
          </>
        )}
      </button>
      {failed && (
        <div className="flex flex-wrap gap-2 border-b border-line px-3.5 py-2.5">
          <Button
            size="sm"
            variant="soft"
            disabled={fixing}
            onClick={async () => {
              setFixing(true);
              try {
                const rewritten = await safeRewritePrompt(video.prompt, video.error);
                if (video.planId && video.ideaId) {
                  updateIdeaPrompt(video.planId, video.ideaId, rewritten);
                }
                setDraftDirection(rewritten);
                router.push("/app/make");
              } catch {
                // Rewrite unavailable — fall back to editing the original.
                setDraftDirection(video.prompt);
                router.push("/app/make");
              } finally {
                setFixing(false);
              }
            }}
          >
            {fixing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {fixing ? "Rewriting…" : "Fix & retry"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={fixing}
            onClick={() => {
              setDraftDirection(video.prompt);
              router.push("/app/make");
            }}
          >
            <Repeat2 size={14} /> Edit in Studio
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={() => {
              if (confirm("Remove this failed render? Its credits were already refunded.")) {
                removeVideo(video.id);
              }
            }}
          >
            <Trash2 size={14} /> Remove
          </Button>
        </div>
      )}
      <div className="p-3.5">
        <p className="line-clamp-2 text-sm text-fg">{video.prompt}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="accent">
            {model.glyph} {model.name}
          </Badge>
          <span className="text-xs text-faint">{timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </Card>
  );
}

function ContentModal({ video, onClose }: { video: VideoJob | null; onClose: () => void }) {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const plans = useStore((s) => s.plans);
  const removeVideo = useStore((s) => s.removeVideo);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  // A fresh video in the modal starts with fresh action states — otherwise
  // "Saved" from the previous video blocks saving this one.
  const videoId = video?.id;
  useEffect(() => {
    setSaved(false);
    setCopied(false);
    setDownloading(false);
  }, [videoId]);

  if (!video) return null;

  const model = getModel(video.modelId);
  const sources = (video.elements ?? []).map((id) => byId[id]).filter(Boolean) as Asset[];
  // Reference media the job carries directly (frames, product photos…) that
  // isn't already represented by a library asset above.
  const sourceUrls = new Set(sources.flatMap((a) => [a.url, a.posterUrl].filter(Boolean) as string[]));
  const extraImages = [
    ...new Set(
      [video.firstFrameUrl, video.lastFrameUrl, ...(video.refImageUrls ?? [])].filter(
        (u): u is string => !!u && !sourceUrls.has(u),
      ),
    ),
  ];
  const extraVideos = (video.refVideoUrls ?? []).filter((u) => !sourceUrls.has(u));
  // Provenance: the plan idea this video was made from.
  const fromPlan = video.planId ? plans.find((p) => p.id === video.planId) : null;
  const fromIdea = fromPlan?.ideas.find((i) => i.id === video.ideaId) ?? null;

  function remix() {
    if (!video) return;
    setDraftElements(video.elements ?? []);
    setDraftDirection(video.direction ?? "");
    onClose();
    router.push("/app/make");
  }

  return (
    <Modal open={!!video} onClose={onClose} size="lg" title="Video">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={video.videoUrl} poster={video.posterUrl} controls autoPlay playsInline className="w-full rounded-xl bg-black" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          {model.glyph} {model.name}
        </Badge>
        <Badge>{TIERS[video.tier].label}</Badge>
        <Badge>{video.durationSec}s</Badge>
        <Badge>{video.aspectRatio}</Badge>
        {video.audio && <Badge tone="teal">Audio</Badge>}
        <span className="text-xs text-faint">{timeAgo(video.createdAt)}</span>
      </div>

      {/* Legacy provenance: productions made in the old Plan surface. Plain
          info — the Plan page no longer exists, so nothing to navigate to. */}
      {fromPlan && (
        <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <Lightbulb size={14} className="shrink-0 text-accent-2" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
            From production: <span className="font-semibold">{fromIdea?.title ?? "idea"}</span>
            <span className="text-muted"> · “{fromPlan.brief}”</span>
          </span>
        </div>
      )}

      {/* The production record: everything this video was made from — the
          prompt and every picture/video that steered it — stays attached. */}
      <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
            How it was made
          </span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(video.prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* clipboard unavailable — the prompt is visible to select */
              }
            }}
            // Negative margin keeps the layout tight while the padded box
            // gives the tap a real ~36px target on phones.
            className="-m-2 flex items-center gap-1 p-2 text-[11.5px] font-medium text-muted hover:text-fg"
          >
            {copied ? (
              <>
                <Check size={12} className="text-teal" /> Copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy prompt
              </>
            )}
          </button>
        </div>
        <p className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
          {video.prompt}
        </p>

        {(sources.length > 0 || extraImages.length > 0 || extraVideos.length > 0) && (
          <>
            <div className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-faint">
              Pictures &amp; media used
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {sources.map((a) => (
                <span key={a.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <AssetThumb a={a} className="aspect-video w-full" />
                  <span className="block truncate px-1.5 py-1 text-[10.5px] text-muted" title={a.name}>
                    {a.class === "storyboard" ? "Storyboard · " : ""}
                    {a.name}
                  </span>
                </span>
              ))}
              {extraImages.map((u, i) => (
                <span key={u} className="overflow-hidden rounded-lg border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Reference image ${i + 1}`} className="aspect-video w-full object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[10.5px] text-muted">
                    Reference image {i + 1}
                  </span>
                </span>
              ))}
              {extraVideos.map((u, i) => (
                <span key={u} className="overflow-hidden rounded-lg border border-line bg-surface">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={u} muted playsInline preload="metadata" className="aspect-video w-full object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[10.5px] text-muted">
                    Reference video {i + 1}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="primary" size="sm" onClick={remix}>
          <Repeat2 size={15} /> Remix
        </Button>
        <Button
          variant="soft"
          size="sm"
          disabled={saved}
          onClick={() => {
            // Once per open — repeated clicks were minting duplicate assets.
            saveVideoToAssets(video.id);
            setSaved(true);
          }}
        >
          {saved ? (
            <>
              <Check size={15} className="text-teal" /> Saved to Assets
            </>
          ) : (
            <>
              <Bookmark size={15} /> Save to Assets
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={downloading}
          onClick={async () => {
            // A real download — the plain link just opened the video in a tab
            // (cross-origin URLs ignore the `download` attribute).
            const url = video.videoUrl ?? video.posterUrl;
            if (!url) return;
            setDownloading(true);
            try {
              const blob = await (await fetch(url)).blob();
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `vibvid-${video.id}.${video.videoUrl ? "mp4" : "png"}`;
              a.click();
              URL.revokeObjectURL(a.href);
            } catch {
              window.open(url, "_blank", "noreferrer");
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (!confirm("Delete this video permanently? This can't be undone.")) return;
            removeVideo(video.id);
            onClose();
          }}
        >
          <Trash2 size={15} /> Delete
        </Button>
      </div>
    </Modal>
  );
}

function GridSkeleton() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 h-8 w-40 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("rounded-[var(--radius-xl2)] border border-line bg-surface-2")}>
            <div className="aspect-video w-full rounded-t-[var(--radius-xl2)] bg-surface-3" />
            <div className="space-y-2 p-3.5">
              <div className="h-3 w-full rounded bg-surface-3" />
              <div className="h-3 w-2/3 rounded bg-surface-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
