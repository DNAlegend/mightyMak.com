// The Strategist — the studio's directing room. Takes a creator's goal or a
// whole story and directs it into a sequence of clips: for each clip a
// recommended length (5 / 10 / 15s), its role in the cut, why that length,
// and a complete second-by-second script. Script writing runs on Claude when
// ANTHROPIC_API_KEY is set (Ark engine otherwise — see src/lib/llm.ts).
// Each clip lands on the Plan surface, where the creator sends it to Make.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured, llmEngine } from "@/lib/llm";

export const maxDuration = 60;

const SYSTEM = `You are a seasoned film director and viral short-form strategist working inside an AI video studio.
The creator gives you a goal, an idea, or a WHOLE STORY. Direct it into a sequence of clips a cinematic AI video model will shoot — one generation per clip.

FIRST decide the cut:
- How many clips the piece truly needs (1–5). A single simple idea is ONE clip. A story gets broken into scenes that cut together.
- For EACH clip, recommend its length from exactly {5, 10, 15} seconds and know why:
  · 5s — one beat: a hook, a punchline, a single reveal or transformation. No room for more.
  · 10s — two movements: build then payoff, question then answer, before then after.
  · 15s — a mini-narrative: setup, turn, payoff. Only for beats that earn the time.
Sequence like a director: open on the strongest hook, escalate, land the payoff or call-to-action last.

CRITICAL — every clip is generated INDEPENDENTLY, with no memory of the others. Each clip's script must be fully self-contained AND keep continuity: repeat the same precise description of the protagonist (age, look, wardrobe), the world, and the color grade in every clip, word for word where possible, so the clips cut together as one piece.

Respond with STRICT JSON only, no markdown fences:
{"title":"...","logline":"...","direction":"...","clips":[{"title":"...","role":"...","durationSec":5,"why":"...","prompt":"..."}]}
- "title": name of the whole piece, same language as the creator's goal. At most 8 words.
- "logline": one-sentence pitch for the piece, same language as the goal.
- "direction": 2–3 sentences of overall treatment — arc across the clips, tone, look, continuity anchors. Same language as the goal.
- clips[].title: punchy clip name, same language as the goal, at most 8 words.
- clips[].role: the clip's job in the cut, ONE word or two — e.g. "Hook", "Build", "Reveal", "Payoff", "CTA".
- clips[].durationSec: 5, 10 or 15 — your recommendation.
- clips[].why: one sentence, same language as the goal: why this beat gets this length.
- clips[].prompt: the shooting script — ALWAYS in English, written for EXACTLY that clip's length:
  · A second-by-second timeline ("0-2s: ... 2-5s: ...") whose beats add up to the full duration — never shorter, never longer.
  · Every beat concrete and visual: one subject with an exact action, setting and props, camera movement and framing (macro, POV, dolly-in, whip-pan, orbit, crash-zoom...), lighting and color, pacing and transitions. One strong action per beat.
  · The model generates NATIVE AUDIO: after the timeline add one "Audio:" sentence — ambience, foley synced to the action, music energy, and (only when it strengthens the clip) one short spoken line in double quotes with the speaker described.
  · End with one sentence of overall mood, style and color grade — identical across clips.
  · NEVER request on-screen text, captions, subtitles, watermarks, logos or UI overlays — the model renders text poorly.
  · 100–180 words.
Never reference real brand names, logos, trademarked or copyrighted characters, franchises, or real public figures.`;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "direction", "clips"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    direction: { type: "string" },
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "role", "durationSec", "why", "prompt"],
        properties: {
          title: { type: "string" },
          role: { type: "string" },
          durationSec: { type: "integer", enum: [5, 10, 15] },
          why: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
  },
};

/** Snap an arbitrary model-suggested length to the offered 5/10/15. */
function snapDuration(n: unknown): number {
  const v = Number(n) || 5;
  return [5, 10, 15].reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), 5);
}

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: "Strategist not configured" }, { status: 501 });
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

  const body = await req.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 4000) : "";
  if (!brief) return NextResponse.json({ error: "Empty brief" }, { status: 400 });

  let raw: string;
  try {
    raw = await chatText({
      system: SYSTEM,
      user: `Creator's goal or story: ${brief}`,
      maxTokens: 3600,
      temperature: 0.9,
      jsonSchema: PLAN_SCHEMA,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
    return NextResponse.json({ error: `Strategist error: ${detail}` }, { status: 502 });
  }

  // Models sometimes wrap JSON in fences or prose — extract the object.
  const match = raw.match(/\{[\s\S]*\}/);
  let title = "";
  let logline = "";
  let direction = "";
  let clips: Array<{ title: string; role: string; durationSec: number; why: string; prompt: string }> = [];
  try {
    const parsed = JSON.parse(match ? match[0] : raw);
    title = typeof parsed?.title === "string" ? parsed.title.slice(0, 120) : "";
    logline = typeof parsed?.logline === "string" ? parsed.logline.slice(0, 300) : "";
    direction = typeof parsed?.direction === "string" ? parsed.direction.slice(0, 700) : "";
    clips = (Array.isArray(parsed?.clips) ? parsed.clips : [])
      .filter(
        (c: unknown): c is { title: string; prompt: string; role?: string; why?: string; durationSec?: number } =>
          !!c &&
          typeof (c as { title?: unknown }).title === "string" &&
          typeof (c as { prompt?: unknown }).prompt === "string",
      )
      .map((c: { title: string; prompt: string; role?: string; why?: string; durationSec?: number }) => ({
        title: String(c.title).slice(0, 120),
        role: String(c.role ?? "").slice(0, 24),
        durationSec: snapDuration(c.durationSec),
        why: String(c.why ?? "").slice(0, 300),
        prompt: String(c.prompt).slice(0, 1400),
      }))
      .slice(0, 6);
  } catch {
    clips = [];
  }
  if (clips.length === 0) {
    return NextResponse.json({ error: "The Strategist returned nothing usable — try again" }, { status: 502 });
  }
  // `engine` is a debug field the UI ignores — confirms which writer ran.
  return NextResponse.json({ title, logline, direction, clips, engine: llmEngine() });
}
