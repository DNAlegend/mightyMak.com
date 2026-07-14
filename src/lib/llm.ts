// Server-side LLM router for script writing (the Strategist and the
// Director). Prefers Claude when ANTHROPIC_API_KEY is configured — much
// stronger prompt craft for Seedance — and falls back to the Ark engine
// otherwise, so the app keeps working with no Anthropic key present.
// Never import this from client components.

import Anthropic from "@anthropic-ai/sdk";

const ARK_BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";
const ARK_MODEL = process.env.ARK_DIRECTOR_MODEL ?? "deepseek-v4-flash-260425";
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ARK_API_KEY);
}

export function llmEngine(): "claude" | "ark" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "ark";
}

type ChatArgs = {
  system: string;
  user: string;
  /** Visible-output budget. The Claude path adds headroom on top for adaptive thinking. */
  maxTokens: number;
  /** Ark only — Claude Opus 4.8 rejects sampling parameters. */
  temperature?: number;
  /** Claude only — constrains the response to this JSON Schema. Ark relies on the prompt. */
  jsonSchema?: Record<string, unknown>;
};

export async function chatText({ system, user, maxTokens, temperature, jsonSchema }: ChatArgs): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    // Stream and collect: long plans (up to ~15k output tokens with thinking)
    // would risk HTTP timeouts on a non-streaming request.
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      // Adaptive thinking shares this budget with the visible answer.
      max_tokens: Math.max(maxTokens + 6000, 8000),
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
      ...(jsonSchema
        ? { output_config: { format: { type: "json_schema" as const, schema: jsonSchema } } }
        : {}),
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new Error("The writer declined this brief — rephrase and try again");
    let out = "";
    for (const block of response.content) if (block.type === "text") out += block.text;
    if (!out.trim()) throw new Error("The writer returned nothing — try again");
    return out.trim();
  }

  const res = await fetch(`${ARK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: ARK_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(detail || `LLM error ${res.status}`);
  }
  const json = await res.json();
  const out: string = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!out) throw new Error("The writer returned nothing — try again");
  return out;
}
