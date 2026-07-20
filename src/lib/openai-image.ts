// OpenAI image generation (GPT Image 2). Two endpoints, one entry point:
// /v1/images/generations for pure text-to-image, /v1/images/edits when
// reference images steer the output (identity, product, style). Both return
// base64 PNG. Enabled by OPENAI_API_KEY on the server.

const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export function openaiImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** GPT Image canvas per aspect: square, landscape or portrait. */
function sizeFor(aspectRatio: string): string {
  if (aspectRatio === "1:1") return "1024x1024";
  const [w, h] = aspectRatio.split(":").map(Number);
  return w >= h ? "1536x1024" : "1024x1536";
}

/** Max bytes accepted per reference image download. */
const REF_MAX_BYTES = 12 * 1024 * 1024;
/** The OpenAI render must finish well under the route's 300s ceiling so a
 *  slow render fails INSIDE the handler (where the refund runs) rather than
 *  being killed by the platform with the debit stranded. */
const RENDER_TIMEOUT_MS = 240_000;

/**
 * A reference URL we're willing to fetch server-side: plain https to a
 * public host — no credentials, no ports, no IP literals, no loopback or
 * private/link-local names. This fetch runs with OUR egress, so it must
 * never become a probe into internal networks.
 */
function safeRefUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) || // any IPv4 literal
    host.includes(":") // any IPv6 literal
  ) {
    return null;
  }
  return u;
}

/**
 * Generate one image and return the PNG bytes, or throw with the API's error
 * message. Reference images (public URLs) are fetched and forwarded to the
 * edits endpoint, which GPT Image treats as high-fidelity inputs.
 */
export async function openaiGenerateImage(opts: {
  model: string;
  prompt: string;
  aspectRatio: string;
  refImageUrls?: string[];
}): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const size = sizeFor(opts.aspectRatio);
  const refs = (opts.refImageUrls ?? []).slice(0, 6);

  let res: Response;
  if (refs.length) {
    const form = new FormData();
    form.append("model", opts.model);
    form.append("prompt", opts.prompt);
    form.append("size", size);
    form.append("quality", "high");
    for (const [i, url] of refs.entries()) {
      const safe = safeRefUrl(url);
      if (!safe) throw new Error("A reference image URL is not allowed");
      let r: Response;
      try {
        // No redirects: a public image doesn't need them, and following one
        // would let a redirecting host steer this fetch somewhere private.
        r = await fetch(safe, { redirect: "error", signal: AbortSignal.timeout(20_000) });
      } catch (e) {
        console.warn("[openai-image] ref fetch failed:", safe.hostname, e instanceof Error ? e.message : e);
        throw new Error("A reference image could not be fetched");
      }
      if (!r.ok) {
        // Log the status server-side; never echo it to the caller (that
        // would make this an internal-network status oracle).
        console.warn("[openai-image] ref fetch status", r.status, "from", safe.hostname);
        throw new Error("A reference image could not be fetched");
      }
      const len = Number(r.headers.get("content-length") ?? 0);
      if (len > REF_MAX_BYTES) throw new Error("A reference image is too large");
      const blob = await r.blob();
      if (blob.size > REF_MAX_BYTES) throw new Error("A reference image is too large");
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
      const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      form.append("image[]", new File([blob], `ref-${i + 1}.${ext}`, { type }));
    }
    res = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
  } else {
    res = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: opts.model, prompt: opts.prompt, size, quality: "high" }),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(detail || `OpenAI image error ${res.status}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Buffer.from(b64, "base64");
}
