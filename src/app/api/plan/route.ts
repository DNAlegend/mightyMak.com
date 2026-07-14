// The Strategist — the studio's directing room. Takes a creator's goal or a
// whole story plus an optional target runtime and cast, and directs it into
// a PRODUCTION: a sequence of shots (each one Seedance generation, 5/10/15s)
// with a recommended length and a complete second-by-second script per shot.
// Script writing runs on Claude when ANTHROPIC_API_KEY is set (Ark engine
// otherwise — see src/lib/llm.ts). Each shot lands on the Plan surface,
// where the creator sends it to Make.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured, llmEngine } from "@/lib/llm";

export const maxDuration = 300;

const SYSTEM = `You are a seasoned film director and viral short-form strategist running a video production inside an AI video studio.
The creator gives you a goal, an idea, or a WHOLE STORY — plus sometimes a target runtime and a cast of characters. Direct it into ONE production: a sequence of shots a cinematic AI video model will generate — one generation per shot, stitched together afterwards into the full video.

FIRST decide the story spine, then the cut:
- The spine: one continuous story from first frame to last — setup, escalation, payoff. Every shot must advance it. Nothing may contradict an earlier shot: props, wardrobe, weather, injuries, light and time of day evolve in one consistent direction across the whole movie.
- Total runtime. If the creator gives a target, the shot lengths must add up to within ±10% of it. If not, recommend the right total for the goal — a scroll-stopper can be one 5s shot; a story or ad may earn 30–120 seconds.
- How many shots (1–16). Every shot's length is exactly 5, 10 or 15 seconds:
  · 5s — one beat: a hook, a punchline, a single reveal or transformation.
  · 10s — two movements: build then payoff, question then answer, before then after.
  · 15s — a mini-narrative: setup, turn, payoff. Only for beats that earn the time.
Sequence like a director: open on the strongest hook, escalate, land the payoff or call-to-action last. Vary framing and rhythm between consecutive shots so the edit breathes.

SEAMLESS HANDOFFS — the shots must cut together into one film:
- End every shot on a clear, freezable final image, described concretely in its last beat (where the subject is, facing which way, doing what).
- Begin the next shot by re-establishing exactly that state in its first clause — same location state, same wardrobe, continuous time (or a deliberate time-jump the script names, e.g. "later that night") — then move the story forward.
- Never open two consecutive shots with the same framing; change angle or shot size across every cut.

CAST — when the creator supplies characters, they are the protagonists:
- Use them by name in shot scripts. Do not invent extra main characters when a cast is given.
- CONSISTENCY IS SACRED: every shot is generated independently, so in EVERY shot where a character appears, repeat the exact same one-line physical description of them (from the cast list, enriched once with wardrobe you choose), word for word. Same wardrobe, same hair, same look in every shot unless the story demands a change — and then describe the change explicitly in that shot.
Without a cast, keep continuity the same way: one protagonist described identically in every shot.

Respond with STRICT JSON only, no markdown fences:
{"title":"...","logline":"...","direction":"...","clips":[{"title":"...","role":"...","durationSec":5,"why":"...","prompt":"..."}]}
- "title": name of the production, same language as the creator's goal. At most 8 words.
- "logline": one-sentence pitch for the piece, same language as the goal.
- "direction": 2–4 sentences of overall treatment — arc across the shots, tone, look, and the continuity anchors (character look lines, location, color grade) every shot repeats. Same language as the goal.
- clips[].title: punchy shot name, same language as the goal, at most 8 words.
- clips[].role: the shot's job in the cut, ONE word or two — e.g. "Hook", "Build", "Reveal", "Turn", "Payoff", "CTA".
- clips[].durationSec: 5, 10 or 15 — your recommendation.
- clips[].why: one sentence, same language as the goal: why this beat gets this length.
- clips[].prompt: the shooting script — ALWAYS in English, HYPER-DETAILED, written for EXACTLY that shot's length. Write like a cinematographer's shot card: specific nouns, verbs of motion, nothing vague.
  · A second-by-second timeline ("0-2s: ... 2-5s: ...") in beats of 2–4 seconds whose lengths add up to the full duration — never shorter, never longer.
  · Every beat concrete and visual: one subject with one exact action; setting, props and textures; camera movement AND framing (macro, POV, low-angle dolly-in, whip-pan, orbit, crash-zoom, handheld...); the light source and color of the light; pacing. One strong action per beat — never several vague ones.
  · Name the optics where they sell the shot: focal feel (wide 24mm distortion, compressed 85mm portrait, macro), depth of field (shallow with creamy bokeh, deep focus), rack focus between subjects, anamorphic flare, lens height.
  · Stage in depth: put something specific in the foreground, midground and background so the frame has layers, and describe surface detail the camera is close to — skin texture, condensation beads, fabric weave, brushed metal, dust in a light shaft.
  · Give the physics one clause when motion is the point: cloth swaying, liquid pouring and settling, steam curling, hair in wind, particles drifting — the model simulates these beautifully when named.
  · The first beat re-establishes the previous shot's final image in one clause (skip for shot 1); the last beat lands the freezable final image the next shot will pick up.
  · The model generates NATIVE AUDIO: after the timeline add one "Audio:" sentence — name the music's genre and energy (and when it swells or cuts), 1–2 foley details synced to specific on-screen actions, room tone/ambience, and (only when it strengthens the shot) ONE short spoken line under 12 words in double quotes with the speaker described.
  · End with one sentence of overall mood, style and color grade — identical across shots.
  · NEVER request on-screen text, captions, subtitles, watermarks, logos or UI overlays — the model renders text poorly.
  · 150–220 words.
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
  // Target runtime for the whole production (optional — Director decides otherwise).
  const targetSec =
    Number.isFinite(Number(body?.targetSec)) && Number(body?.targetSec) > 0
      ? Math.min(240, Math.max(5, Math.round(Number(body.targetSec))))
      : null;
  // Cast of saved characters: name + one-line look, used as continuity anchors.
  const cast: Array<{ name: string; look: string }> = Array.isArray(body?.cast)
    ? body.cast
        .filter((c: unknown): c is { name?: unknown; look?: unknown } => !!c && typeof c === "object")
        .map((c: { name?: unknown; look?: unknown }) => ({
          name: String(c.name ?? "").slice(0, 60),
          look: String(c.look ?? "").slice(0, 300),
        }))
        .filter((c: { name: string }) => c.name)
        .slice(0, 6)
    : [];

  const userMsg = [
    targetSec
      ? `Target runtime for the whole production: about ${targetSec} seconds (shot lengths must add up to within ±10% of this).`
      : "Target runtime: your call — recommend the right total for the goal.",
    cast.length
      ? `Cast (use these characters, keep their look identical in every shot):\n${cast
          .map((c) => `- ${c.name}${c.look ? ` — ${c.look}` : ""}`)
          .join("\n")}`
      : null,
    `Creator's goal or story: ${brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Scale the output budget with the expected shot count.
  const expectedShots = targetSec ? Math.min(16, Math.max(1, Math.round(targetSec / 10))) : 5;
  let raw: string;
  try {
    raw = await chatText({
      system: SYSTEM,
      user: userMsg,
      // ~350 output tokens per richer 150-220 word script + JSON overhead.
      maxTokens: Math.min(9000, 900 * expectedShots + 600),
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
    direction = typeof parsed?.direction === "string" ? parsed.direction.slice(0, 900) : "";
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
        prompt: String(c.prompt).slice(0, 2000),
      }))
      .slice(0, 16);
  } catch {
    clips = [];
  }
  if (clips.length === 0) {
    return NextResponse.json({ error: "The Strategist returned nothing usable — try again" }, { status: 502 });
  }
  // `engine` is a debug field the UI ignores — confirms which writer ran.
  return NextResponse.json({ title, logline, direction, clips, engine: llmEngine() });
}
