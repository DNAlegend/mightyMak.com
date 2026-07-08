"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Image as ImageIcon,
  Play,
  Sparkles,
  Loader2,
  Trash2,
  Download,
  Bookmark,
  Repeat2,
  Check,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getModel } from "@/lib/models";
import { TIERS, type Asset, type VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState, Modal, Progress, Segmented } from "@/components/ui";
import { AssetThumb } from "@/components/shared";

type Filter = "all" | "video" | "image";

export function LibraryView() {
  const videos = useStore((s) => s.videos);
  const hydrated = useStore((s) => s.hasHydrated);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () => videos.filter((v) => filter === "all" || (v.modality ?? "video") === filter),
    [videos, filter],
  );
  const open = videos.find((v) => v.id === openId) ?? null;
  const done = videos.filter((v) => v.status === "succeeded").length;

  if (!hydrated) return <GridSkeleton />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Videos</h1>
          <p className="mt-1 text-sm text-muted">
            {videos.length === 0
              ? "Everything you generate is collected and managed here."
              : `${done} ${done === 1 ? "item" : "items"} generated.`}
          </p>
        </div>
        <Button onClick={() => (window.location.href = "/app")} className="hidden sm:inline-flex">
          <Sparkles size={16} /> Make
        </Button>
      </header>

      {videos.length === 0 ? (
        <EmptyState
          icon={<Film size={24} />}
          title="Nothing here yet"
          description="Generate from Make and your videos and images land here — ready to play, download, remix and reuse."
          action={
            <Button onClick={() => (window.location.href = "/app")}>
              <Sparkles size={16} /> Make something
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "video", label: "Video" },
                { value: "image", label: "Image" },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <ContentCard key={v.id} video={v} onOpen={() => v.status === "succeeded" && setOpenId(v.id)} />
            ))}
          </div>
        </>
      )}

      <ContentModal video={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ContentCard({ video, onOpen }: { video: VideoJob; onOpen: () => void }) {
  const rendering = video.status === "rendering";
  const model = getModel(video.modelId);
  const isImage = video.modality === "image";
  return (
    <Card className="group overflow-hidden">
      <button
        onClick={onOpen}
        disabled={rendering}
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
        ) : (
          <>
            {video.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.posterUrl}
                alt={video.prompt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              // Real generated clips have no poster — the first frame is one.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={video.videoUrl}
                preload="metadata"
                muted
                playsInline
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
            {!isImage && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play size={18} className="ml-0.5 text-black" fill="black" />
                </span>
              </span>
            )}
            <span className="absolute left-2 top-2">
              <Badge tone="neutral" className="bg-black/60 capitalize text-white border-white/20 backdrop-blur-sm">
                {isImage ? <ImageIcon size={11} /> : <Film size={11} />} {video.modality ?? "video"}
              </Badge>
            </span>
            {!isImage && (
              <span className="absolute bottom-2 right-2">
                <Badge tone="neutral" className="bg-black/60 text-white border-white/20 backdrop-blur-sm">
                  {video.durationSec}s
                </Badge>
              </span>
            )}
          </>
        )}
      </button>
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
  const removeVideo = useStore((s) => s.removeVideo);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const [saved, setSaved] = useState(false);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  if (!video) return null;

  const model = getModel(video.modelId);
  const isImage = video.modality === "image";
  const sources = (video.elements ?? []).map((id) => byId[id]).filter(Boolean) as Asset[];

  function remix() {
    if (!video) return;
    setDraftElements(video.elements ?? []);
    setDraftDirection(video.direction ?? "");
    onClose();
    router.push("/app");
  }

  return (
    <Modal open={!!video} onClose={onClose} size="lg" title={isImage ? "Image" : "Video"}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.posterUrl} alt={video.prompt} className="w-full rounded-xl bg-black" />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={video.videoUrl} poster={video.posterUrl} controls autoPlay playsInline className="w-full rounded-xl bg-black" />
      )}
      <p className="mt-4 text-sm text-fg">{video.prompt}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          {model.glyph} {model.name}
        </Badge>
        {!isImage && <Badge>{TIERS[video.tier].label}</Badge>}
        {!isImage && <Badge>{video.durationSec}s</Badge>}
        <Badge>{video.aspectRatio}</Badge>
        {!isImage && video.audio && <Badge tone="teal">Audio</Badge>}
        <span className="text-xs text-faint">{timeAgo(video.createdAt)}</span>
      </div>

      {sources.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Made from</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-[12px] text-fg">
                <AssetThumb a={a} className="h-5 w-5 rounded-full" />
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="primary" size="sm" onClick={remix}>
          <Repeat2 size={15} /> Remix
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            saveVideoToAssets(video.id);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? (
            <>
              <Check size={15} className="text-teal" /> Saved
            </>
          ) : (
            <>
              <Bookmark size={15} /> Save to Assets
            </>
          )}
        </Button>
        <a href={video.videoUrl ?? video.posterUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            <Download size={15} /> Download
          </Button>
        </a>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => {
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
