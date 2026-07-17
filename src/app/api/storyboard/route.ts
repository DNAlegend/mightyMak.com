// The Storyboard Artist — turns a creator's brief into the two halves of a
// storyboard: a detailed STORY FLOW prompt (how the video runs from first
// beat to last, panel by panel) and a single IMAGE prompt that renders the
// whole board as ONE picture — an N-panel grid, like a film storyboard sheet.
// Writing runs on Claude when ANTHROPIC_API_KEY is set (Ark engine otherwise
// — see src/lib/llm.ts); the sheet itself renders on Seedream via Make's
// normal /api/generate path. Nothing here is auto-submitted to a model —
// the creator reviews both prompts first.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured, llmEngine } from "@/lib/llm";
import { allowRequest, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { hasStudioAccess, ACTIVATE_MESSAGE } from "@/lib/access";

export const maxDuration = 120;

const SYSTEM = `You are a veteran storyboard artist and film director working inside an AI video studio.
The creator gives you a video idea (in ANY language) plus a panel count and grid layout. Board it into ONE complete short video: a sequence of panels that reads from the very first frame to the very last.

FIRST direct the story: setup, escalation, payoff — every panel advances it. One protagonist (or product) kept visually IDENTICAL across all panels: decide their exact look once (face, hair, wardrobe, colors) and repeat that same one-line description wherever they appear. Vary shot size and angle between consecutive panels so the board reads like a real film: establishing wide, push-ins, close-ups, inserts, a strong final image.

Respond with STRICT JSON only, no markdown fences:
{"title":"...","flow":"...","imagePrompt":"..."}

- "title": the video's name, same language as the brief, at most 6 words.

- "flow": the STORY FLOW prompt — how the video plays from start to end, ALWAYS in English. Format it as numbered beats, one per panel, in panel order:
"Panel 1 — ..." each 2–3 sentences: the subject and their one exact action, the setting with concrete props and textures, camera framing AND movement (wide establishing, low-angle dolly-in, macro insert, whip-pan...), and the light source and color of the light.
Repeat the protagonist's identical one-line look in every panel where they appear. After the last panel add one closing sentence of overall mood, style and color grade that applies to the whole film.
This text is later given to a cinematic AI video model as the master script — make every beat concrete and shootable, nothing vague. 25–45 words per panel.

- "imagePrompt": ONE image-generation prompt, ALWAYS in English, describing a single picture: a professional film storyboard sheet — a grid of panels (use the exact grid layout you are given) on a clean white background with thin gutters, a small panel number in the corner of each cell. Then describe each cell in panel order ("Panel 1: ...") in one vivid sentence — the same moment as the flow's matching beat, with its framing. State explicitly that the same protagonist appears identical in every panel — same face, hair and wardrobe — and end with the visual style, lighting and color grade shared by all panels. 120–220 words.

Never request captions, dialogue text, subtitles, watermarks or logos inside the panels (panel numbers are the only text). Never reference real brand names, logos, trademarked or copyrighted characters, franchises, or real public figures.`;

const STORYBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "flow", "imagePrompt"],
  properties: {
    title: { type: "string" },
    flow: { type: "string" },
    imagePrompt: { type: "string" },
  },
};

/** Panel counts the UI offers, with the grid each renders as. */
const GRIDS: Record<number, string> = {
  4: "2 columns × 2 rows",
  6: "3 columns × 2 rows",
  9: "3 columns × 3 rows",
};

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: "Storyboard writer not configured" }, { status: 501 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Paid-only: an unsubscribed account can sign in but can't spend our tokens.
  if (!(await hasStudioAccess(sb, userData.user.id, userData.user.email))) {
    return NextResponse.json({ error: ACTIVATE_MESSAGE }, { status: 402 });
  }

  if (!(await allowRequest(sb, "storyboard", 20))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) return NextResponse.json({ error: "Empty brief" }, { status: 400 });
  const panels = [4, 6, 9].includes(Number(body?.panels)) ? Number(body.panels) : 9;
  const style = typeof body?.style === "string" ? body.style.slice(0, 200) : "";

  const userMsg = [
    `Panels: ${panels}, laid out as a ${GRIDS[panels]} grid.`,
    style ? `Visual style: ${style}.` : null,
    `Creator's video idea: ${brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    raw = await chatText({
      system: SYSTEM,
      user: userMsg,
      // ~45 words per flow beat + the sheet prompt + JSON overhead.
      maxTokens: Math.min(4000, 220 * panels + 1200),
      temperature: 0.85,
      jsonSchema: STORYBOARD_SCHEMA,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
    return NextResponse.json({ error: `Storyboard writer error: ${detail}` }, { status: 502 });
  }

  // Models sometimes wrap JSON in fences or prose — extract the object.
  const match = raw.match(/\{[\s\S]*\}/);
  let title = "";
  let flow = "";
  let imagePrompt = "";
  try {
    const parsed = JSON.parse(match ? match[0] : raw);
    title = typeof parsed?.title === "string" ? parsed.title.slice(0, 120) : "";
    flow = typeof parsed?.flow === "string" ? parsed.flow.slice(0, 6000) : "";
    imagePrompt = typeof parsed?.imagePrompt === "string" ? parsed.imagePrompt.slice(0, 3000) : "";
  } catch {
    /* fall through to the empty check below */
  }
  if (!flow || !imagePrompt) {
    return NextResponse.json(
      { error: "The storyboard writer returned nothing usable — try again" },
      { status: 502 },
    );
  }
  // `engine` is a debug field the UI ignores — confirms which writer ran.
  return NextResponse.json({ title, flow, imagePrompt, engine: llmEngine() });
}
