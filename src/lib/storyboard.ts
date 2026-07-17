// Storyboard helpers shared between the Storyboard studio and Make.

import type { Asset } from "./types";

/**
 * A storyboard's video length, read back from the saved asset: the explicit
 * "Video length" part when present, else the "<N>-second" opening the writer
 * always puts in the prompt. Returns null when neither matches 5/10/15.
 */
export function storyboardDurationSec(a: Pick<Asset, "parts" | "promptFragment">): number | null {
  const part = a.parts?.find((p) => p.label.startsWith("Video length"));
  const fromPart = part ? parseInt(part.url, 10) : NaN;
  if ([5, 10, 15].includes(fromPart)) return fromPart;
  const m = a.promptFragment?.match(/(\d{1,2})[-\s]second/i);
  const fromPrompt = m ? parseInt(m[1], 10) : NaN;
  return [5, 10, 15].includes(fromPrompt) ? fromPrompt : null;
}
