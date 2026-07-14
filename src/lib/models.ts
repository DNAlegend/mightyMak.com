// The AI model registry. Each entry is data describing a pluggable provider —
// its modality, capabilities, params and pricing. The UI renders model pickers
// and cost from this; /api/generate maps each entry's arkModel to the real
// BytePlus engine (Seedance video, Seedream image) and charges by these rates.

import type { Modality } from "./types";

export type Resolution = "480p" | "720p" | "1080p" | "4K";

export type Capability =
  | "text-to-video"
  | "image-to-video"
  | "text-to-image"
  | "image-to-image";

export interface ModelProvider {
  id: string;
  name: string;
  vendor: string;
  modality: Modality;
  capabilities: Capability[];
  blurb: string;
  /** Emoji glyph used as a lightweight model avatar. */
  glyph: string;
  accent: string;
  badge?: "recommended" | "fast" | "new" | "soon";
  enabled: boolean;
  /** Video pricing: flat fallback rate (credits per second). */
  creditsPerSec?: number;
  /**
   * Quality-priced rates: credits per second at each resolution. Grounded in
   * upstream token pricing — tokens scale with pixels × seconds, so 720p costs
   * ~2.2× a 480p render and 1080p ~5×.
   */
  creditsPerSecByRes?: Partial<Record<Resolution, number>>;
  /** Resolutions this model can render. */
  resolutions?: Resolution[];
  maxDurationSec?: number;
  /** Image pricing. */
  creditsPerImage?: number;
  /** Real BytePlus ModelArk model id — presence enables real generation. */
  arkModel?: string;
  /** Default resolution for this model. */
  arkResolution?: Resolution;
  /** Image output class — newer Seedream models require ≥2K canvases. */
  arkSize?: "1k" | "2k";
}

export const MODELS: ModelProvider[] = [
  {
    id: "seedance-2-pro",
    name: "Vib Production",
    vendor: "VIBVID",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "The detailed production model — cinematic motion, native audio, up to native 4K.",
    glyph: "🎬",
    accent: "#ec1320",
    badge: "recommended",
    enabled: true,
    // Native-audio Seedance 2.0 is genuinely pricey and scales with pixels. Rates
    // are set to ≥3× the real image-to-video cost at the cheapest sell price
    // ($0.043/credit) — our shot-to-shot flow is reference-based, so i2v is the
    // dominant path; pure text-to-video still clears cost. A 5s 1080p ≈ 90 credits,
    // a 5s 4K ≈ 200. See billing.ts for the plan economics.
    creditsPerSec: 18,
    creditsPerSecByRes: { "480p": 5, "720p": 9, "1080p": 18, "4K": 40 },
    resolutions: ["480p", "720p", "1080p", "4K"],
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-260128",
    arkResolution: "1080p",
  },
  {
    id: "seedance-2-mini",
    name: "Vib Draft",
    vendor: "VIBVID",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "The draft model — fast, cheap takes to explore ideas before a Production render.",
    glyph: "✏️",
    accent: "#0d9488",
    badge: "fast",
    enabled: true,
    // Basic video: a 5s 480p draft is ~15 credits, 720p ~20 — cheap enough to
    // iterate freely, still comfortably above cost.
    creditsPerSec: 3,
    creditsPerSecByRes: { "480p": 3, "720p": 4 },
    resolutions: ["480p", "720p"],
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-mini-260615",
    arkResolution: "480p",
  },
  {
    // Legacy tier — hidden from pickers; old generations still resolve its badge.
    id: "seedance-2-lite",
    name: "Vib Fast",
    vendor: "VIBVID",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "Faster, cheaper drafts at 720p.",
    glyph: "⚡",
    accent: "#0d9488",
    badge: "fast",
    enabled: false,
    creditsPerSec: 5,
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-fast-260128",
    arkResolution: "720p",
  },
  {
    id: "seedream-3",
    name: "Vib Image",
    vendor: "VIBVID",
    modality: "image",
    capabilities: ["text-to-image"],
    blurb: "The proven workhorse — high-fidelity images with rich detail.",
    glyph: "🖼️",
    accent: "#d6457a",
    badge: "recommended",
    enabled: true,
    // ≥3× the ~$0.03 Seedream cost at the $0.043 floor.
    creditsPerImage: 3,
    arkModel: "seedream-4-0-250828",
  },
  {
    id: "seedream-45",
    name: "Vib Image Plus",
    vendor: "VIBVID",
    modality: "image",
    capabilities: ["text-to-image", "image-to-image"],
    blurb: "Sharper composition and better text rendering than 4.0.",
    glyph: "🎨",
    accent: "#b05ad0",
    enabled: true,
    creditsPerImage: 4,
    arkModel: "seedream-4-5-251128",
    arkSize: "2k",
  },
  {
    id: "seedream-5",
    name: "Vib Image Pro",
    vendor: "VIBVID",
    modality: "image",
    capabilities: ["text-to-image", "image-to-image"],
    blurb: "The flagship — best realism, lighting and fine detail, up to 2K.",
    glyph: "✨",
    accent: "#ec1320",
    badge: "new",
    enabled: true,
    // 2K hi-res output (~$0.135) — priced ≥3× at the floor.
    creditsPerImage: 10,
    arkModel: "seedream-5-0-260128",
    arkSize: "2k",
  },
];

export const MODELS_BY_ID: Record<string, ModelProvider> = Object.fromEntries(
  MODELS.map((m) => [m.id, m]),
);

export const DEFAULT_MODEL_ID = "seedance-2-pro";

export function getModel(id?: string | null): ModelProvider {
  return (id && MODELS_BY_ID[id]) || MODELS_BY_ID[DEFAULT_MODEL_ID];
}

export function listModels(opts?: { modality?: Modality; enabledOnly?: boolean }): ModelProvider[] {
  return MODELS.filter(
    (m) =>
      (!opts?.modality || m.modality === opts.modality) &&
      (!opts?.enabledOnly || m.enabled),
  );
}

/** The resolution actually rendered: the requested one if the model supports it. */
export function clampResolution(model: ModelProvider, res?: string | null): Resolution {
  const supported = model.resolutions ?? (model.arkResolution ? [model.arkResolution] : ["720p" as Resolution]);
  if (res && (supported as string[]).includes(res)) return res as Resolution;
  return model.arkResolution ?? supported[supported.length - 1];
}

/** Credits per second on a model at a given quality. */
export function videoRate(model: ModelProvider, resolution?: string | null): number {
  const res = clampResolution(model, resolution);
  return model.creditsPerSecByRes?.[res] ?? model.creditsPerSec ?? 12;
}

/** Credits a generation will cost on a given model — quality included. */
export function priceFor(
  model: ModelProvider,
  opts: { durationSec?: number; count?: number; hasRefs?: boolean; resolution?: string | null },
): number {
  if (model.modality === "video") {
    const refPenalty = opts.hasRefs ? 4 : 0;
    const secs = opts.durationSec ?? 6;
    return Math.ceil(secs * videoRate(model, opts.resolution)) + refPenalty;
  }
  const refPenalty = opts.hasRefs ? 1 : 0;
  const count = opts.count ?? 1;
  return count * (model.creditsPerImage ?? 2) + refPenalty;
}
