// The VIBVID starter catalog — curated, pickable building blocks.
// Assets are organized into five classes: Characters, Dresses, Scenes, Dances
// and Audio. A client uploads their own into the same classes. In the Studio,
// a shot is assembled by picking one asset per slot; each contributes a
// `promptFragment` to the composed prompt.
// Thumbnails are local SVG art in /public/studio (no external deps).

import type { AssetClass } from "./types";
import generatedData from "./generated.json";

const generated = generatedData as Record<string, string>;

export interface StudioElement {
  id: string;
  class: AssetClass;
  name: string;
  blurb: string;
  promptFragment: string;
  accent: string;
  kind: "image" | "audio";
}

export interface ClassMeta {
  key: AssetClass;
  /** Singular label used for a slot, e.g. "Character". */
  label: string;
  /** Plural label used for the library section, e.g. "Characters". */
  plural: string;
  tagline: string;
  /** lucide-react icon name, resolved in components. */
  icon: "user" | "shirt" | "image" | "activity" | "music" | "package";
  glyph: string;
  categoryId: string;
}

export const ASSET_CLASSES: ClassMeta[] = [
  { key: "character", label: "Character", plural: "Characters", tagline: "Who's on screen", icon: "user", glyph: "🧑‍🎤", categoryId: "class-character" },
  { key: "product", label: "Product", plural: "Products", tagline: "What you're selling", icon: "package", glyph: "📦", categoryId: "class-product" },
  { key: "dress", label: "Dress", plural: "Dresses", tagline: "What they wear", icon: "shirt", glyph: "👗", categoryId: "class-dress" },
  { key: "scene", label: "Scene", plural: "Scenes", tagline: "Where it happens", icon: "image", glyph: "🏙️", categoryId: "class-scene" },
  { key: "dance", label: "Dance", plural: "Dances", tagline: "How they move", icon: "activity", glyph: "💃", categoryId: "class-dance" },
  { key: "audio", label: "Audio", plural: "Audio", tagline: "What it sounds like", icon: "music", glyph: "🎵", categoryId: "class-audio" },
];

export const CLASS_BY_KEY: Record<AssetClass, ClassMeta> = Object.fromEntries(
  ASSET_CLASSES.map((c) => [c.key, c]),
) as Record<AssetClass, ClassMeta>;

export function categoryIdForClass(key: AssetClass): string {
  return CLASS_BY_KEY[key].categoryId;
}

const E = (
  id: string,
  cls: AssetClass,
  name: string,
  blurb: string,
  promptFragment: string,
  accent: string,
  kind: "image" | "audio" = "image",
): StudioElement => ({ id, class: cls, name, blurb, promptFragment, accent, kind });

export const CATALOG: StudioElement[] = [
  // ---- Characters ----
  E("cast-astronaut", "character", "Astronaut", "Lone explorer", "a lone astronaut", "#7c6cff"),
  E("cast-neon-samurai", "character", "Neon Samurai", "Blade of the city", "a neon-lit samurai warrior", "#ff5d8f"),
  E("cast-cyber-detective", "character", "Cyber Detective", "Trench-coat sleuth", "a cyberpunk detective in a trench coat", "#36c5d6"),
  E("cast-forest-spirit", "character", "Forest Spirit", "Ethereal guardian", "an ethereal glowing forest spirit", "#54d6a0"),
  E("cast-deep-sea-diver", "character", "Deep-Sea Diver", "Into the abyss", "a deep-sea diver in a vintage suit", "#36a6d6"),
  E("cast-desert-nomad", "character", "Desert Nomad", "Wanderer of dunes", "a desert nomad", "#f0a955"),

  // ---- Dresses ----
  E("dress-evening-gown", "dress", "Evening Gown", "Red-carpet elegance", "an elegant flowing evening gown", "#d6457a"),
  E("dress-streetwear", "dress", "Streetwear", "Urban and relaxed", "relaxed urban streetwear", "#5a7cff"),
  E("dress-kimono", "dress", "Silk Kimono", "Traditional grace", "a traditional silk kimono", "#e0884a"),
  E("dress-cyber-armor", "dress", "Cyber Armor", "Future-forged plating", "sleek futuristic cyber armor", "#36c5d6"),
  E("dress-royal-robe", "dress", "Royal Robe", "Regal and ornate", "an ornate royal robe", "#b05ad0"),
  E("dress-tuxedo", "dress", "Tuxedo", "Sharp and tailored", "a sharp tailored tuxedo", "#3a4a7a"),

  // ---- Scenes ----
  E("set-neon-tokyo", "scene", "Neon Tokyo", "Rain-soaked streets", "a rain-soaked neon Tokyo street at night", "#ff4d9d"),
  E("set-mars-colony", "scene", "Mars Colony", "Red-planet frontier", "a futuristic Mars colony at dawn", "#ff7a45"),
  E("set-enchanted-forest", "scene", "Enchanted Forest", "Misty and magical", "a misty enchanted forest with glowing spores", "#3fbf7f"),
  E("set-underwater-city", "scene", "Underwater City", "Bioluminescent depths", "a glowing bioluminescent underwater city", "#2f9fd6"),
  E("set-desert-highway", "scene", "Desert Highway", "Endless golden road", "an endless desert highway at golden hour", "#f4b740"),
  E("set-cloud-temple", "scene", "Cloud Temple", "Above the clouds", "an ancient temple floating above the clouds", "#9a8bff"),

  // ---- Dances ----
  E("dance-hiphop", "dance", "Hip-Hop", "Energetic and sharp", "an energetic hip-hop street dance", "#ff5d8f"),
  E("dance-ballet", "dance", "Ballet", "Graceful and precise", "a graceful ballet performance", "#c95dff"),
  E("dance-breakdance", "dance", "Breakdance", "Explosive floorwork", "a dynamic breakdance routine", "#ff7a45"),
  E("dance-salsa", "dance", "Salsa", "Fiery and rhythmic", "a passionate salsa dance", "#e05a5a"),
  E("dance-robot", "dance", "Robot", "Pop-and-lock precision", "a precise robotic pop-and-lock dance", "#36c5d6"),
  E("dance-contemporary", "dance", "Contemporary", "Fluid and expressive", "a fluid contemporary dance", "#5ab0c0"),

  // ---- Products ----
  E("prod-serum", "product", "Glow Serum", "Skincare hero", "a frosted glass skincare serum bottle", "#d6457a"),
  E("prod-sneakers", "product", "Court Sneakers", "Limited edition", "a pair of limited-edition white and orange sneakers", "#f0a955"),
  E("prod-earbuds", "product", "Aura Earbuds", "True wireless", "matte-black wireless earbuds in a charging case", "#6d5ef8"),
  E("prod-watch", "product", "Meridian Watch", "Minimal steel", "a minimalist steel wristwatch", "#5a7cff"),
  E("prod-handbag", "product", "Atelier Handbag", "Structured leather", "a structured tan leather designer handbag", "#b05ad0"),
  E("prod-coffee", "product", "Ember Coffee", "Small-batch roast", "a matte-black craft coffee bag", "#e0884a"),

  // ---- Audio ----
  E("score-orchestral", "audio", "Epic Orchestral", "Sweeping and grand", "epic orchestral", "#e0884a", "audio"),
  E("score-synthwave", "audio", "Synthwave", "Retro neon pulse", "driving synthwave", "#ff5db8", "audio"),
  E("score-lofi", "audio", "Lo-Fi", "Chilled and warm", "chill lo-fi beats", "#5ab0c0", "audio"),
  E("score-strings", "audio", "Tense Strings", "Edge-of-seat", "tense suspenseful strings", "#b05ad0", "audio"),
  E("score-ambient", "audio", "Ambient", "Soft and dreamy", "soft ambient pads", "#7c9ccf", "audio"),
  E("score-drums", "audio", "Tribal Drums", "Primal energy", "powerful tribal drums", "#e05a5a", "audio"),
];

export const CATALOG_BY_ID: Record<string, StudioElement> = Object.fromEntries(
  CATALOG.map((e) => [e.id, e]),
);

export function thumbFor(id: string): string {
  // Real Seedream renders (from `npm run generate:demo -- --studio`) win over
  // the hand-drawn SVG placeholders.
  return generated[id] ?? `/studio/${id}.svg`;
}

export function elementsByClass(cls: AssetClass): StudioElement[] {
  return CATALOG.filter((e) => e.class === cls);
}

/** Minimal shape the prompt composer needs from a picked asset. */
export interface Composable {
  class?: AssetClass;
  promptFragment?: string;
}

/**
 * Build a natural-language prompt from the assets picked for a shot, in the
 * class vocabulary: "<character> wearing <dress>, performing <dance>, in
 * <scene>. Soundtrack: <audio>."
 */
export function composeFromAssets(picked: Composable[], direction?: string): string {
  // Don't repeat what the direction already says: after "Improve prompt" the
  // Director usually weaves the cast description into the script verbatim, and
  // re-prepending it produced doubled openings ("Kato, a chef… Kato, a chef…").
  // Only skip the scaffold when EVERY picked fragment is already in the
  // direction — dropping fragments one by one would detach dependents (a dress
  // with its character filtered out would hang off "the subject").
  const normDir = (direction ?? "").toLowerCase().replace(/\s+/g, " ");
  const contained = (a: Composable) =>
    !!a.promptFragment &&
    normDir.includes(a.promptFragment.trim().toLowerCase().replace(/\s+/g, " "));
  const allContained = picked.length > 0 && picked.every(contained);

  const frag = (a: Composable) => a.promptFragment;
  const join = (arr: Composable[]) => arr.map(frag).filter(Boolean).join(" and ");
  const ofClass = (c: AssetClass) => picked.filter((a) => a.class === c && a.promptFragment);

  const characters = ofClass("character");
  const products = ofClass("product");
  const dresses = ofClass("dress");
  const dances = ofClass("dance");
  const scenes = ofClass("scene");
  const audios = ofClass("audio");

  if (picked.length === 0) return direction?.trim() ?? "";
  // Everything picked is already described in the direction — use it as-is.
  if (allContained) return direction?.trim() ?? "";

  const subject = characters.length
    ? join(characters)
    : products.length && !characters.length
      ? join(products)
      : "the subject";
  const wear = dresses.length ? ` wearing ${join(dresses)}` : "";
  const move = dances.length ? ` performing ${join(dances)}` : "";
  const feat = characters.length && products.length ? ` presenting ${join(products)}` : "";
  const place = scenes.length ? ` in ${join(scenes)}` : "";
  const dir = direction?.trim() ? ` ${direction.trim()}.` : "";
  const music = audios.length ? ` Soundtrack: ${join(audios)}.` : "";

  return `${subject}${wear}${move}${feat}${place}.${dir}${music}`.replace(/\s+\./g, ".").trim();
}
