"use client";

import {
  User,
  Shirt,
  Image as ImageIcon,
  Activity,
  Music,
  Film,
  Loader2,
  Check,
  Layers,
  Package,
} from "lucide-react";
import type { ClassMeta } from "@/lib/catalog";
import { listModels, type ModelProvider } from "@/lib/models";
import {
  TIERS,
  isComposite,
  type AspectRatio,
  type Asset,
  type Modality,
  type VideoJob,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Progress } from "@/components/ui";

/* ----------------------------- Class icon ------------------------------- */
const CLASS_ICONS: Record<ClassMeta["icon"], typeof User> = {
  user: User,
  shirt: Shirt,
  image: ImageIcon,
  activity: Activity,
  music: Music,
  package: Package,
};

export function ClassIcon({ icon, size = 16, className }: { icon: ClassMeta["icon"]; size?: number; className?: string }) {
  const Icon = CLASS_ICONS[icon];
  return <Icon size={size} className={className} />;
}

/* ----------------------------- Asset thumb ------------------------------ */
export function thumbOf(a: Asset): string | null {
  if (a.posterUrl) return a.posterUrl;
  if (a.kind === "image") return a.url;
  if (a.kind === "audio" && /\.(svg|png|jpe?g|webp)$/.test(a.url)) return a.url;
  return null;
}

export function AssetThumb({ a, className }: { a: Asset; className?: string }) {
  const src = thumbOf(a);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={a.name} className={cn("object-cover", className)} />;
  }
  const Icon = a.kind === "audio" ? Music : Film;
  return (
    <div className={cn("flex items-center justify-center bg-surface-3 text-faint", className)}>
      <Icon size={20} />
    </div>
  );
}

/** Small badge shown on composite assets. */
export function CompositeBadge({ a }: { a: Asset }) {
  if (!isComposite(a)) return null;
  return (
    <Badge tone="accent" className="bg-black/55 text-white border-white/20 backdrop-blur-sm">
      <Layers size={11} /> {a.parts!.length}
    </Badge>
  );
}

/* ----------------------------- Model picker ----------------------------- */
const MODALITIES: { value: Modality; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
];

export function ModelPicker({
  modality,
  modelId,
  onModality,
  onModel,
  lockModality = false,
}: {
  modality: Modality;
  modelId: string;
  onModality: (m: Modality) => void;
  onModel: (id: string) => void;
  /** Hide the Video/Image toggle (dedicated generator pages). */
  lockModality?: boolean;
}) {
  const models = listModels({ modality });
  return (
    <div>
      <div className={cn("mb-3 inline-flex rounded-xl border border-line bg-surface-2 p-1", lockModality && "hidden")}>
        {MODALITIES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModality(m.value)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              modality === m.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {models.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            active={modelId === m.id}
            onClick={() => m.enabled && onModel(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ModelCard({ model, active, onClick }: { model: ModelProvider; active: boolean; onClick: () => void }) {
  const badge = model.badge;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!model.enabled}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-accent ring-2 ring-accent/30 bg-accent-soft/40"
          : "border-line bg-surface hover:border-line-2",
        !model.enabled && "cursor-not-allowed opacity-55",
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ background: `${model.accent}1f` }}
      >
        {model.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-fg">{model.name}</span>
          {active && <Check size={14} className="shrink-0 text-accent-2" />}
        </span>
        <span className="mt-0.5 block text-[11px] text-faint">{model.vendor}</span>
        <span className="mt-1.5 line-clamp-2 block text-[12px] leading-snug text-muted">{model.blurb}</span>
      </span>
      {badge && (
        <span className="absolute right-2.5 top-2.5">
          {badge === "recommended" && <Badge tone="accent">Recommended</Badge>}
          {badge === "fast" && <Badge tone="teal">Fast</Badge>}
          {badge === "new" && <Badge tone="teal">New</Badge>}
          {badge === "soon" && <Badge tone="neutral">Soon</Badge>}
        </span>
      )}
    </button>
  );
}

/* ------------------------------- Aspect --------------------------------- */
export const aspectClass: Record<AspectRatio, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-[420px] mx-auto",
  "1:1": "aspect-square max-h-[420px] mx-auto",
};

/* ------------------------------ Result hero ----------------------------- */
/** Renders a job's in-progress / finished output, for both video and image. */
export function ResultHero({ job }: { job: VideoJob }) {
  const ar = job.aspectRatio;
  const isImage = job.modality === "image";

  if (job.status === "rendering") {
    return (
      <div
        className={cn(
          "shimmer flex w-full flex-col items-center justify-center rounded-xl border border-line bg-surface-2",
          aspectClass[ar],
        )}
      >
        <Loader2 size={24} className="animate-spin text-accent-2" />
        <p className="mt-3 text-sm font-medium text-fg">
          {isImage ? "Generating your image…" : "Rendering your shot…"}
        </p>
        <div className="mt-3 w-40">
          <Progress value={job.progress} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-faint">{job.progress}%</p>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-danger/30 bg-surface-2 p-6 text-center",
          aspectClass[ar],
        )}
      >
        <p className="text-sm font-semibold text-danger">Generation failed</p>
        <p className="max-w-md break-words text-xs leading-relaxed text-muted">
          {job.error ?? "Something went wrong — your credits were not spent."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={job.posterUrl}
          alt={job.prompt}
          className={cn("w-full rounded-xl bg-black object-cover", aspectClass[ar])}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={job.id}
          src={job.videoUrl}
          poster={job.posterUrl}
          controls
          autoPlay
          muted
          loop
          playsInline
          className={cn("w-full rounded-xl bg-black object-cover", aspectClass[ar])}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="teal">
          <Check size={11} /> Ready
        </Badge>
        {!isImage && <Badge tone="accent">{TIERS[job.tier].label}</Badge>}
        {!isImage && <Badge>{job.durationSec}s</Badge>}
        <Badge>{job.aspectRatio}</Badge>
        {job.simulated && <Badge tone="neutral">Sample preview</Badge>}
      </div>
      {job.simulated && (
        <p className="text-xs text-faint">
          This is a demo sample clip, not a real render — sign in on a deployment with the
          MightyMak engine configured to generate for real.
        </p>
      )}
    </div>
  );
}
