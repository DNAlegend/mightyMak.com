// Purpose presets — the "what are you making?" layer above the raw prompt.
// Picking one configures format, model, duration, which asset slots matter,
// tailored prompt ideas, and a style suffix woven into the final prompt.

import type { AspectRatio, AssetClass, Modality } from "./types";

export interface Purpose {
  id: string;
  label: string;
  glyph: string;
  tagline: string;
  modality: Modality;
  aspectRatio: AspectRatio;
  durationSec: number;
  modelId: string;
  /** Asset classes that matter most for this purpose, surfaced first. */
  classes: AssetClass[];
  placeholder: string;
  ideas: string[];
  /** Style language appended to the composed prompt. */
  styleSuffix: string;
}

export const PURPOSES: Purpose[] = [
  {
    id: "ugc-ad",
    label: "UGC Ad",
    glyph: "🤳",
    tagline: "Creator-style ad that converts",
    modality: "video",
    aspectRatio: "9:16",
    durationSec: 5,
    modelId: "seedance-2-pro",
    classes: ["product", "character", "scene"],
    placeholder: "Who's showing your product, where, and what's the energy?",
    ideas: [
      "A young woman shows the serum to camera in her bright bathroom, excited and authentic",
      "Hands unbox the sneakers on a wooden desk, tissue paper crinkling, satisfying reveal",
      "A guy taste-tests the coffee at his kitchen counter and reacts, morning light",
    ],
    styleSuffix: "UGC style, handheld iPhone framing, authentic creator energy, natural lighting",
  },
  {
    id: "product",
    label: "Product Film",
    glyph: "📦",
    tagline: "Hero shots that sell",
    modality: "video",
    aspectRatio: "16:9",
    durationSec: 5,
    modelId: "seedance-2-pro",
    classes: ["product", "scene"],
    placeholder: "Describe the hero moment — rotation, reveal, splash, macro detail…",
    ideas: [
      "The watch rotates on a glass pedestal, light sweeping across the sapphire dial",
      "The earbuds case opens in macro as particles drift through a beam of light",
      "The coffee bag drops into frame with a soft bounce, beans scattering in slow motion",
    ],
    styleSuffix: "premium studio product film, dramatic rim lighting, macro detail, commercial look",
  },
  {
    id: "fashion",
    label: "Fashion",
    glyph: "👗",
    tagline: "Editorial looks in motion",
    modality: "video",
    aspectRatio: "16:9",
    durationSec: 5,
    modelId: "seedance-2-pro",
    classes: ["character", "dress", "scene", "dance"],
    placeholder: "Who wears it, how do they move, and where?",
    ideas: [
      "A model in the crimson gown walks toward camera through a mirrored hallway, slow motion",
      "Close-up pan across the kimono's embroidery, then reveal the full silhouette",
    ],
    styleSuffix: "fashion film, editorial lighting, slow motion, shallow depth of field",
  },
  {
    id: "brand",
    label: "Brand Film",
    glyph: "🎬",
    tagline: "Cinematic story beats",
    modality: "video",
    aspectRatio: "16:9",
    durationSec: 10,
    modelId: "seedance-2-pro",
    classes: ["scene", "character", "audio"],
    placeholder: "Set the scene — the place, the mood, the camera move…",
    ideas: [
      "A drone rises over a neon-lit city at dusk revealing the skyline, teal and magenta grade",
      "Golden-hour aerial over a desert highway, a lone car cutting through the dunes",
    ],
    styleSuffix: "cinematic brand film, sweeping camera movement, rich color grade, anamorphic feel",
  },
  {
    id: "social",
    label: "Social Reel",
    glyph: "⚡",
    tagline: "Fast, punchy, vertical",
    modality: "video",
    aspectRatio: "9:16",
    durationSec: 5,
    modelId: "seedance-2-lite",
    classes: ["character", "dance", "scene", "audio"],
    placeholder: "One punchy moment — a move, a reveal, a reaction…",
    ideas: [
      "A dancer hits a freeze mid-breakdance as the lights strobe, camera whips around",
      "POV smoothie pour over a bowl in one satisfying motion, bright kitchen",
    ],
    styleSuffix: "punchy social reel, bold motion, high energy, crisp vertical framing",
  },
  {
    id: "product-shot",
    label: "Product Shot",
    glyph: "📸",
    tagline: "Clean e-commerce frames",
    modality: "image",
    aspectRatio: "1:1",
    durationSec: 5,
    modelId: "seedream-5",
    classes: ["product", "scene"],
    placeholder: "The product, the surface, the light…",
    ideas: [
      "The serum bottle on wet black slate, a single beam of morning light",
      "The sneakers floating over a pastel podium, soft shadows",
    ],
    styleSuffix: "premium e-commerce product photograph, seamless backdrop, soft studio shadows, crisp detail",
  },
  {
    id: "poster",
    label: "Poster / Key Art",
    glyph: "🎞️",
    tagline: "Cinematic one-sheets",
    modality: "image",
    aspectRatio: "9:16",
    durationSec: 5,
    modelId: "seedream-5",
    classes: ["character", "scene", "dress"],
    placeholder: "The hero, the world, the mood…",
    ideas: [
      "The neon samurai from behind, facing a rain-soaked city, title space at the top",
      "The astronaut small against a giant glowing Mars colony, epic scale",
    ],
    styleSuffix: "cinematic movie poster key art, dramatic composition, rich color grade, poster lighting",
  },
  {
    id: "still",
    label: "Still Image",
    glyph: "🖼️",
    tagline: "Posters, thumbnails, key art",
    modality: "image",
    aspectRatio: "1:1",
    durationSec: 5,
    modelId: "seedream-3",
    classes: ["character", "product", "scene", "dress"],
    placeholder: "Describe the shot — subject, mood, lighting…",
    ideas: [
      "The astronaut portrait lit by a red planet's glow, poster composition",
      "The handbag on wet black marble with a single spotlight, luxury key art",
    ],
    styleSuffix: "high-detail photograph, dramatic lighting, rich color grading",
  },
  {
    id: "custom",
    label: "Freeform",
    glyph: "✨",
    tagline: "No rails — just prompt",
    modality: "video",
    aspectRatio: "16:9",
    durationSec: 5,
    modelId: "seedance-2-pro",
    classes: ["character", "product", "dress", "scene", "dance", "audio"],
    placeholder: "Describe your shot — a character, a setting, a mood, a camera move…",
    ideas: [
      "A neon samurai walks through rain-soaked Tokyo at night, cinematic slow motion",
      "Close-up of a desert nomad at golden hour, dust drifting in the wind",
      "An astronaut floating above a glowing Mars colony, sweeping drone shot",
    ],
    styleSuffix: "",
  },
];

export const PURPOSE_BY_ID: Record<string, Purpose> = Object.fromEntries(
  PURPOSES.map((p) => [p.id, p]),
);

export const DEFAULT_PURPOSE_ID = "custom";
