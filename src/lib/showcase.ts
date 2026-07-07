// Landing-page media registry.
//
// Every entry resolves through src/lib/generated.json first: when
// `npm run generate:demo` has rendered real Seedream/Seedance output into
// /public/generated/, those files are served; otherwise the hand-crafted
// /art SVG placeholders are.

import generatedData from "./generated.json";

export interface ShowcaseMedia {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  label: string;
  tag: string;
}

const generated = generatedData as Record<string, string>;

/** Real generated file if it exists, else the crafted placeholder. */
function resolve(id: string, fallback: string): Pick<ShowcaseMedia, "type" | "src"> {
  const src = generated[id];
  if (!src) return { type: "image", src: fallback };
  return { type: src.endsWith(".mp4") ? "video" : "image", src };
}

/** The big hero visual — real Seedance clip > real Seedream still > SVG. */
export const HERO: ShowcaseMedia = {
  id: "hero",
  ...resolve("hero-video", generated["hero-neon-city"] ?? "/art/hero-neon-city.svg"),
  poster: generated["hero-neon-city"] ?? "/art/hero-neon-city.svg",
  label: "Neon samurai in rain-soaked Tokyo",
  tag: "Mak Pro",
};

/** The prompt shown typed into the hero's mock studio bar. */
export const HERO_PROMPT =
  "A neon samurai walks through rain-soaked Tokyo at night, cinematic slow motion";

/** Small floating thumbnails layered over the hero for flavor. */
export const HERO_CHIPS: ShowcaseMedia[] = [
  { id: "chip-char", type: "image", src: "/studio/cast-neon-samurai.svg", label: "Neon Samurai", tag: "Character" },
  { id: "chip-scene", type: "image", src: "/studio/set-cloud-temple.svg", label: "Cloud Temple", tag: "Scene" },
  { id: "chip-dress", type: "image", src: "/studio/dress-evening-gown.svg", label: "Evening Gown", tag: "Dress" },
];

const TILE = (n: string, label: string): ShowcaseMedia => ({
  id: n,
  ...resolve(n, `/art/${n}.svg`),
  label,
  tag: "MightyMak",
});

/** The "Made with MightyMak" gallery. */
export const SHOWCASE: ShowcaseMedia[] = [
  TILE("art-product-reveal", "Product reveal"),
  TILE("art-neon-tokyo", "Neon Tokyo"),
  TILE("art-cyber-detective", "Cyber Detective"),
  TILE("art-forest-spirit", "Forest Spirit"),
  TILE("art-ballet", "Ballet study"),
  TILE("art-desert-run", "Desert run"),
  TILE("art-underwater-city", "Underwater City"),
  TILE("art-astro-mars", "Mars Colony"),
  TILE("art-cloud-temple", "Cloud Temple"),
  TILE("art-evening-gown", "Evening Gown"),
];
