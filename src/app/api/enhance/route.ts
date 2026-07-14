// The Director — turns a rough brief (in ANY language) plus the picked
// assets into a professional English video/image prompt. Script writing
// runs on Claude when ANTHROPIC_API_KEY is set (Ark engine otherwise —
// see src/lib/llm.ts). The creator reviews and edits the result before
// generating; nothing is auto-submitted to the video model.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured } from "@/lib/llm";

export const maxDuration = 60;

const SYSTEM = `You are a world-class commercial video director writing generation prompts for a professional cinematic video generation model.
The user's brief may be written in ANY language — always answer with the final prompt in ENGLISH.
Weave in every provided asset description naturally (they are visual references the model will also receive as images).

FOR A VIDEO — write a shot card, hyper-detailed, sized to the clip length you are given:
- A second-by-second timeline ("0-2s: ... 2-5s: ...") in beats of 2–4 seconds whose lengths add up to the full clip — never shorter, never longer.
- Every beat concrete and visual: one subject with one exact action; setting, props and textures; camera movement AND framing (macro, POV, low-angle dolly-in, whip-pan, orbit, crash-zoom, handheld...); the light source and color of the light.
- Name the optics where they sell the shot (focal feel, shallow or deep focus, rack focus, anamorphic flare) and stage in depth — something specific in foreground, midground and background.
- Give the physics one clause when motion is the point: cloth swaying, liquid pouring, steam curling, hair in wind, drifting particles.
- The model generates NATIVE AUDIO: after the timeline add one "Audio:" sentence — the music's genre and energy, 1–2 foley details synced to on-screen actions, ambience, and (only if the brief calls for one) ONE short spoken line under 12 words in double quotes with the speaker described.
- End with one sentence of mood, style and color grade. 120–190 words total.

FOR A STILL IMAGE — one flowing paragraph: subject and pose, setting, composition and framing, lens feel, lighting, textures, mood and style. 40–110 words.

Never request on-screen text, captions, subtitles, watermarks or logos — the model renders text poorly.
Avoid real brand names, logos, trademarked or copyrighted characters, franchises, and real public figures unless the user explicitly supplies them as their own assets — prefer generic, original descriptions.
Output ONLY the prompt — no preamble, no quotes, no markdown, no explanations.`;

const SAFE_SYSTEM = `You rewrite video prompts that were BLOCKED by an automated copyright filter which inspects the GENERATED video, not just the words.
Removing names is not enough — reimagine the concept so the resulting footage cannot visually resemble any known character, costume, silhouette, franchise, logo, brand, or real person.
Replace iconic costumes, designs, colors and signatures with wholly original ones; describe an ordinary, generic scene; keep only the abstract action, setting and mood.
Answer in ENGLISH as one flowing paragraph, 40–80 words.
Output ONLY the rewritten prompt — no preamble, no quotes, no explanations.`;

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: "Director not configured" }, { status: 501 });
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
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) return NextResponse.json({ error: "Empty brief" }, { status: 400 });
  // The clip length sizes the beat timeline (5/10/15s; defaults to 5).
  const durationSec = [5, 10, 15].includes(Number(body?.durationSec)) ? Number(body.durationSec) : 5;
  const modality = body?.modality === "image" ? "still image" : `${durationSec}-second video clip`;
  const purpose = typeof body?.purpose === "string" ? body.purpose.slice(0, 100) : null;
  const assets: string[] = Array.isArray(body?.assets)
    ? body.assets.filter((a: unknown) => typeof a === "string").slice(0, 12)
    : [];
  // "safe" mode = rewrite a prompt that a content/copyright filter rejected.
  const safe = body?.mode === "safe";
  const avoid = typeof body?.avoid === "string" ? body.avoid.slice(0, 300) : null;

  const userMsg = [
    `Output format: a ${modality}.`,
    purpose ? `Purpose: ${purpose}.` : null,
    assets.length ? `Visual reference assets the model will receive: ${assets.join("; ")}.` : null,
    safe && avoid ? `The filter that blocked it reported: ${avoid}` : null,
    `${safe ? "Prompt to rewrite" : "Creator's brief"}: ${brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  let prompt: string;
  try {
    prompt = await chatText({
      system: safe ? SAFE_SYSTEM : SYSTEM,
      user: userMsg,
      // Beat-timeline video prompts run 120-190 words; images stay short.
      maxTokens: 500,
      temperature: safe ? 0.85 : 0.7,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
    return NextResponse.json({ error: `Director error: ${detail}` }, { status: 502 });
  }
  return NextResponse.json({ prompt });
}
