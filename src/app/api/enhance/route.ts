// The Director — turns a rough brief (in ANY language) plus the picked
// assets into a professional English video/image prompt via an Ark LLM.
// The creator reviews and edits the result before generating; nothing is
// auto-submitted to the video model.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ARK_BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";
const DIRECTOR_MODEL = process.env.ARK_DIRECTOR_MODEL ?? "deepseek-v4-flash-260425";

export const maxDuration = 30;

const SYSTEM = `You are a world-class commercial video director writing generation prompts for a professional cinematic video generation model.
The user's brief may be written in ANY language — always answer with the final prompt in ENGLISH.
Weave in every provided asset description naturally (they are visual references the model will also receive as images).
Structure the prompt as one flowing paragraph covering: subject and action, setting, camera movement, lighting, mood, and style.
Be concrete and visual; prefer verbs of motion; 40–90 words.
Output ONLY the prompt paragraph — no preamble, no quotes, no lists, no explanations.`;

export async function POST(req: Request) {
  if (!process.env.ARK_API_KEY) {
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
  const modality = body?.modality === "image" ? "still image" : "5–10 second video clip";
  const purpose = typeof body?.purpose === "string" ? body.purpose.slice(0, 100) : null;
  const assets: string[] = Array.isArray(body?.assets)
    ? body.assets.filter((a: unknown) => typeof a === "string").slice(0, 12)
    : [];

  const userMsg = [
    `Output format: a ${modality}.`,
    purpose ? `Purpose: ${purpose}.` : null,
    assets.length ? `Visual reference assets the model will receive: ${assets.join("; ")}.` : null,
    `Creator's brief: ${brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(`${ARK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DIRECTOR_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    return NextResponse.json({ error: `Director error: ${detail}` }, { status: 502 });
  }
  const json = await res.json();
  const prompt = json.choices?.[0]?.message?.content?.trim();
  if (!prompt) return NextResponse.json({ error: "Director returned nothing" }, { status: 502 });
  return NextResponse.json({ prompt });
}
