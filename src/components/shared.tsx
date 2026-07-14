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
  ShieldAlert,
  AlertTriangle,
  TextQuote,
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
import { supabase } from "@/lib/supabase";
import { Badge, Progress } from "@/components/ui";

/* --------------------------- Failure messaging -------------------------- */

/** Pull a human sentence out of an Ark/route error string (often JSON). */
function extractMessage(raw?: string): string {
  if (!raw) return "";
  const s = raw.replace(/^Model error:\s*/i, "").trim();
  try {
    const j = JSON.parse(s);
    return String(j?.error?.message ?? j?.message ?? s);
  } catch {
    return s.replace(/^["']|["']$/g, "");
  }
}

/**
 * Split a shooting script into timeline sections ("0-2s: ..."), plus trailing
 * Audio / Style sections when present. Returns null when there's no timeline —
 * the script then renders as a plain paragraph.
 */
export function planSegments(prompt: string): { label: string; text: string }[] | null {
  const re = /(\d+\s*[-–]\s*\d+\s*s)\s*[:.]\s*/gi;
  const out: { label: string; text: string }[] = [];
  let label: string | null = null;
  let last = 0;
  for (let m = re.exec(prompt); m; m = re.exec(prompt)) {
    const before = prompt.slice(last, m.index).trim();
    if (label !== null) out.push({ label, text: before });
    else if (before) out.push({ label: "", text: before });
    label = m[1].replace(/\s+/g, "");
    last = re.lastIndex;
  }
  if (label === null) return null;
  const tail = prompt.slice(last).trim();
  // Peel the closing audio + style directions into their own sections.
  const audioAt = tail.search(/Audio\s*:/i);
  const styleAt = tail.search(/Overall\s+mood|Sound\s+design|Overall\s+style/i);
  const cut = [audioAt, styleAt].filter((i) => i > 0).sort((a, b) => a - b)[0];
  if (cut !== undefined) {
    out.push({ label, text: tail.slice(0, cut).trim() });
    const rest = tail.slice(cut).trim();
    const styleInRest = rest.search(/Overall\s+mood|Sound\s+design|Overall\s+style/i);
    if (/^Audio\s*:/i.test(rest) && styleInRest > 0) {
      out.push({ label: "Audio", text: rest.slice(0, styleInRest).trim() });
      out.push({ label: "Style", text: rest.slice(styleInRest).trim() });
    } else {
      out.push({ label: /^Audio\s*:/i.test(rest) ? "Audio" : "Style", text: rest });
    }
  } else {
    out.push({ label, text: tail });
  }
  return out.filter((s) => s.text);
}

/** Renders a parsed script as labeled beat rows — the studio's script look. */
export function ScriptBeats({
  segments,
  compact,
}: {
  segments: { label: string; text: string }[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-3 rounded-xl border border-line bg-surface-2",
            compact ? "p-2.5" : "p-3",
          )}
        >
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums",
              s.label === "Style" || s.label === "Audio"
                ? "bg-teal-soft text-teal"
                : "bg-accent-soft text-accent-2",
            )}
          >
            {s.label || "Setup"}
          </span>
          <p className={cn("leading-relaxed text-fg", compact ? "text-[13px]" : "text-[13.5px]")}>
            {s.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export type GenErrorKind = "policy" | "timeout" | "credits" | "generic";

/** The exact machine reason (error code + message) for showing alongside the friendly text. */
export function genErrorReason(raw?: string): string {
  if (!raw) return "";
  try {
    const j = JSON.parse(raw.replace(/^Model error:\s*/i, "").trim());
    const code = j?.code ?? j?.error?.code;
    const msg = j?.message ?? j?.error?.message;
    return [code, msg].filter(Boolean).join(" — ");
  } catch {
    return extractMessage(raw);
  }
}

/** Turn a raw failure into a friendly, on-brand title + detail + fix tips. */
export function classifyGenError(raw?: string): {
  kind: GenErrorKind;
  title: string;
  detail: string;
  tips: string[];
} {
  const low = (raw ?? "").toLowerCase();
  if (/audio.*sensitive|sensitive.*audio|outputaudio/.test(low)) {
    return {
      kind: "policy",
      title: "The soundtrack got blocked",
      detail:
        "The generated AUDIO tripped the content filter — this usually comes from crowd chants, song-like music, or celebrity-sounding voices.",
      tips: [
        "Soften the sound direction: ambient or instrumental music instead of crowd roar, chants or lyrics.",
        "Avoid naming songs, artists, or anything that could sound like a real recording.",
        "Fix & retry rewrites the plan automatically to pass the checks.",
      ],
    };
  }
  if (/sensitive|policyviolation|copyright|prohibited|nsfw|violat|risky|not\s*allowed/.test(low)) {
    return {
      kind: "policy",
      title: "Blocked by content checks",
      detail:
        "The generated footage may resemble protected material — a brand, logo, real person or known character.",
      tips: [
        "Remove brand names, franchises, celebrities and iconic costumes — describe original ones instead.",
        "Keep the action and mood; swap recognizable designs for generic, invented ones.",
        "Fix & retry rewrites the plan automatically to pass the checks.",
      ],
    };
  }
  if (/timed out|timeout/.test(low)) {
    return {
      kind: "timeout",
      title: "This took too long",
      detail:
        "The render is taking unusually long. It may still finish and land in My Videos — check back in a few minutes before re-spending.",
      tips: [
        "Reload the page — if the render finished in the background, it will appear in My Videos.",
        "Shorter clips and 720p render faster.",
      ],
    };
  }
  if (/not enough credits|insufficient|402/.test(low)) {
    return {
      kind: "credits",
      title: "Not enough credits",
      detail: "Top up with the Buy button in the top bar, then try again.",
      tips: ["Buy a top-up pack — credits land instantly after payment."],
    };
  }
  const msg = extractMessage(raw);
  return {
    kind: "generic",
    title: "That render didn’t finish",
    detail: msg || "Something went wrong — your credits were refunded. Try again.",
    tips: ["Try again — most one-off failures don’t repeat.", "If it keeps failing, simplify the prompt."],
  };
}

/**
 * Ask the Director to rewrite a prompt so it passes the content checks that
 * just blocked it (mode "safe" + the exact failure as context).
 */
export async function safeRewritePrompt(prompt: string, avoid?: string): Promise<string> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new Error("Sign in to rewrite the plan");
  const res = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ brief: prompt, mode: "safe", avoid: avoid ?? "content policy" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.prompt) throw new Error(data.error ?? "Couldn’t rewrite the plan");
  return data.prompt;
}

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

/**
 * A real video preview: shows a frame from a beat into the clip (opening
 * frames are often blank), and plays muted while hovered.
 */
export function VideoPreview({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      src={src}
      poster={poster}
      preload="metadata"
      muted
      playsInline
      loop
      onLoadedMetadata={(e) => {
        // Always seek a beat in: opening frames are often blank, and seeking
        // also replaces a bad poster (some old jobs stored video urls there).
        const v = e.currentTarget;
        if (Number.isFinite(v.duration) && v.duration > 0) {
          const t = Math.min(1.2, v.duration * 0.15);
          v.currentTime = t;
          v.dataset.previewT = String(t);
        }
      }}
      onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
      onMouseLeave={(e) => {
        const v = e.currentTarget;
        v.pause();
        v.currentTime = Number(v.dataset.previewT ?? 0);
      }}
      className={cn("object-cover", className)}
    />
  );
}

export function AssetThumb({ a, className }: { a: Asset; className?: string }) {
  const src = thumbOf(a);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={a.name} className={cn("object-cover", className)} />;
  }
  if (a.kind === "video" && a.url) {
    return <VideoPreview src={a.url} className={className} />;
  }
  const Icon = a.kind === "audio" ? Music : a.kind === "prompt" ? TextQuote : Film;
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
    const info = classifyGenError(job.error);
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 p-6 text-center",
          aspectClass[ar],
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          {info.kind === "policy" ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
        </span>
        <p className="mt-1 text-sm font-semibold text-fg">{info.title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">{info.detail}</p>
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
          VIBVID engine configured to generate for real.
        </p>
      )}
    </div>
  );
}
