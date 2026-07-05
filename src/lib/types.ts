// Core domain types for the MightyMak front-end (mock data layer).
// These shapes are intentionally close to what the real backend will return,
// so wiring Supabase / BytePlus later is a swap, not a redesign.

export type Tier = "fast" | "standard" | "pro";
export type AspectRatio = "16:9" | "9:16" | "1:1";
export type JobStatus = "rendering" | "succeeded" | "failed";

/** What an AI model produces. */
export type Modality = "video" | "image";

/** How many assets a single shot can hold. */
export const SHOT_LIMIT = 6;

/* --------------------------------- Assets -------------------------------- */

export type AssetKind = "image" | "video" | "audio";

/** The library taxonomy a client organizes their assets into. */
export type AssetClass = "character" | "dress" | "scene" | "dance" | "audio" | "product";

/** Whose library an asset lives in. */
export type AssetOwner = "user" | "business";

/** The role a single part plays inside a composite asset. */
export type PartRole = "primary" | "face" | "reference" | "voice" | "motion";

/**
 * A composite asset bundles several parts under one reusable identity —
 * e.g. a Character that owns a face image, a reference clip and a voice sample.
 * A simple asset is just one `primary` part.
 */
export interface AssetPart {
  role: PartRole;
  kind: AssetKind;
  url: string;
  posterUrl?: string;
  label: string;
}

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  url: string; // data URL (uploads), remote URL (generations), or /studio art (starters)
  posterUrl?: string;
  categoryId: string | null;
  source: "upload" | "generation" | "starter";
  sizeBytes?: number;
  createdAt: number;
  // The library taxonomy + ownership scope.
  class?: AssetClass;
  owner?: AssetOwner;
  // Parts make an asset a composite; absent/length-1 means a simple asset.
  parts?: AssetPart[];
  // Set on curated starter assets so the Studio can use them as building blocks.
  promptFragment?: string;
  accent?: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
  /** Seeded class folders are system folders — not user-editable. */
  system?: boolean;
}

/* ------------------------------- Generation ------------------------------ */

export interface GenerateParams {
  prompt: string;
  tier: Tier;
  durationSec: number;
  aspectRatio: AspectRatio;
  audio: boolean;
  /** Which model produced this — drives the badge + (later) the real adapter. */
  modelId?: string;
  modality?: Modality;
  refAssetId?: string | null;
  /** Asset ids added to the shot — the "add as you go" elements. */
  elements?: string[];
  direction?: string;
  posterUrl?: string;
  /**
   * Public https images steering the video. One image = the first frame;
   * several = reference images (Seedance 2.0 accepts up to REF_IMAGE_LIMIT).
   */
  refImageUrls?: string[];
}

/** Seedance 2.0's hard cap on reference images per video generation. */
export const REF_IMAGE_LIMIT = 9;

/**
 * A generation record. Despite the legacy name it holds both video and image
 * outputs — `modality` discriminates how the result is rendered.
 */
export interface VideoJob {
  id: string;
  prompt: string;
  status: JobStatus;
  progress: number; // 0–100
  tier: Tier;
  durationSec: number;
  aspectRatio: AspectRatio;
  audio: boolean;
  modelId?: string;
  modality?: Modality;
  refAssetId: string | null;
  videoUrl?: string;
  posterUrl?: string;
  creditsCost: number;
  createdAt: number;
  error?: string;
  elements?: string[];
  direction?: string;
  /** True when the result is a demo sample clip, not real model output. */
  simulated?: boolean;
  /** Ark task id for real renders — lets a reload resume polling. */
  taskId?: string;
  /** Reference images steering the render (public https URLs). */
  refImageUrls?: string[];
}

export const TIERS: Record<
  Tier,
  { label: string; resolution: string; creditsPerSec: number; blurb: string }
> = {
  fast: { label: "Fast", resolution: "720p", creditsPerSec: 3, blurb: "Quick drafts" },
  standard: { label: "Standard", resolution: "1080p", creditsPerSec: 12, blurb: "Crisp & balanced" },
  pro: { label: "Pro", resolution: "2K", creditsPerSec: 20, blurb: "Maximum quality" },
};

/** Clip lengths the Seedance models actually support. */
export const DURATIONS = [5, 10] as const;
export const ASPECT_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"];

export function estimateCredits(p: Pick<GenerateParams, "tier" | "durationSec" | "refAssetId">): number {
  const base = Math.ceil(p.durationSec * TIERS[p.tier].creditsPerSec);
  const refPenalty = p.refAssetId ? 5 : 0;
  return base + refPenalty;
}

/** True when an asset bundles more than one part (a composite). */
export function isComposite(a: Asset): boolean {
  return !!a.parts && a.parts.length > 1;
}
