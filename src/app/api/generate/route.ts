// Real generation endpoint — routes Make's requests to BytePlus ModelArk
// (Seedance video / Seedream image) with the API key kept server-side.
//
// POST  — authenticate, spend credits atomically, then:
//           image: generate synchronously, store in Supabase Storage,
//                  insert a succeeded generations row, return it.
//           video: create an Ark task, insert a rendering row (task_id),
//                  return { status: "rendering" } for the client to poll.
// GET ?id= — poll the row's Ark task; on success download the (24h-TTL)
//            result into Storage and finalize the row; on failure refund.
//
// All Supabase access uses the CALLER's token (anon key + Authorization
// header), so RLS applies exactly as it does in the browser.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getModel, priceFor } from "@/lib/models";

// The finalize step downloads the rendered MP4 from Ark and re-uploads it to
// Storage — give the function headroom beyond the serverless default.
export const maxDuration = 60;

const ARK_BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";

const IMAGE_SIZE: Record<string, string> = {
  "16:9": "1280x720",
  "9:16": "720x1280",
  "1:1": "1024x1024",
};

// Seedream 4.5/5.0 reject canvases under ~3.7MP — they render at 2K.
const IMAGE_SIZE_2K: Record<string, string> = {
  "16:9": "2560x1440",
  "9:16": "1440x2560",
  "1:1": "1920x1920",
};

function userClient(req: Request): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function arkHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ARK_API_KEY}` };
}

async function refund(sb: SupabaseClient, cost: number) {
  await sb.rpc("adjust_credits", { delta: cost });
}

async function storeFile(
  sb: SupabaseClient,
  userId: string,
  name: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const path = `${userId}/${name}`;
  const { error } = await sb.storage.from("assets").upload(path, data, { contentType, upsert: true });
  if (error) {
    console.error("[generate] storage upload failed:", error.message);
    return null;
  }
  return sb.storage.from("assets").getPublicUrl(path).data.publicUrl;
}

export async function POST(req: Request) {
  if (!process.env.ARK_API_KEY) {
    return NextResponse.json({ error: "Real generation is not configured" }, { status: 501 });
  }
  const sb = userClient(req);
  if (!sb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const id = typeof body?.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.id) ? body.id : null;
  if (!prompt || !id) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const model = getModel(body.modelId);
  if (!model.arkModel) {
    return NextResponse.json({ error: `${model.name} is not available yet` }, { status: 501 });
  }
  const aspectRatio = IMAGE_SIZE[body.aspectRatio] ? (body.aspectRatio as string) : "16:9";
  // Seedance renders 5s or 10s clips — snap whatever the client sent.
  const durationSec = (Number(body.durationSec) || 5) >= 8 ? 10 : 5;
  const elements = Array.isArray(body.elements) ? body.elements.slice(0, 12) : null;
  const cost = priceFor(model, { durationSec, count: 1, hasRefs: (elements?.length ?? 0) > 0 });

  // Spend credits first, atomically; null balance means insufficient.
  const { data: balance, error: credErr } = await sb.rpc("adjust_credits", { delta: -cost });
  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 500 });
  if (balance === null || balance === undefined) {
    return NextResponse.json({ error: "Not enough credits" }, { status: 402 });
  }

  const baseRow = {
    id,
    user_id: user.id,
    prompt,
    tier: typeof body.tier === "string" ? body.tier : "standard",
    duration_sec: durationSec,
    aspect_ratio: aspectRatio,
    audio: body.audio !== false,
    model_id: model.id,
    modality: model.modality,
    ref_asset_id: null,
    credits_cost: cost,
    elements,
    direction: typeof body.direction === "string" ? body.direction : null,
    created_at: Date.now(),
  };

  if (model.modality === "image") {
    const res = await fetch(`${ARK_BASE}/images/generations`, {
      method: "POST",
      headers: arkHeaders(),
      body: JSON.stringify({
        model: model.arkModel,
        prompt,
        size: (model.arkSize === "2k" ? IMAGE_SIZE_2K : IMAGE_SIZE)[aspectRatio],
        response_format: "b64_json",
        watermark: false,
      }),
    });
    if (!res.ok) {
      await refund(sb, cost);
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json({ error: `Model error: ${detail}` }, { status: 502 });
    }
    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      await refund(sb, cost);
      return NextResponse.json({ error: "Model returned no image" }, { status: 502 });
    }
    const bytes = Buffer.from(b64, "base64");
    const publicUrl = await storeFile(sb, user.id, `gen-${id}.png`, bytes.buffer as ArrayBuffer, "image/png");
    if (!publicUrl) {
      await refund(sb, cost);
      return NextResponse.json({ error: "Failed to store the image" }, { status: 500 });
    }
    await sb.from("generations").insert({ ...baseRow, status: "succeeded", progress: 100, poster_url: publicUrl });
    return NextResponse.json({ status: "succeeded", posterUrl: publicUrl, credits: balance, cost });
  }

  // Video: async Ark task + polling via GET. Picked assets' public images
  // steer the render: one image = the first frame (i2v); several = named
  // reference images (Seedance 2.0 r2v mode, hard cap of 9).
  const flags = ` --resolution ${model.arkResolution ?? "720p"} --duration ${durationSec} --ratio ${aspectRatio} --watermark false`;
  const rawRefs: unknown[] = Array.isArray(body.refImageUrls)
    ? body.refImageUrls
    : typeof body.refImageUrl === "string"
      ? [body.refImageUrl]
      : [];
  const refImageUrls = rawRefs
    .filter((u): u is string => typeof u === "string" && /^https:\/\/.+/i.test(u))
    .slice(0, 9);
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt + flags }];
  if (refImageUrls.length === 1) {
    content.push({ type: "image_url", image_url: { url: refImageUrls[0] } });
  } else {
    for (const u of refImageUrls) {
      content.push({ type: "image_url", image_url: { url: u }, role: "reference_image" });
    }
  }

  let res = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
    method: "POST",
    headers: arkHeaders(),
    body: JSON.stringify({ model: model.arkModel, content }),
  });
  if (!res.ok && refImageUrls.length > 0) {
    // The reference image may be unreachable/unsupported — retry text-only.
    res = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
      method: "POST",
      headers: arkHeaders(),
      body: JSON.stringify({ model: model.arkModel, content: content.slice(0, 1) }),
    });
  }
  if (!res.ok) {
    await refund(sb, cost);
    const detail = (await res.text()).slice(0, 300);
    return NextResponse.json({ error: `Model error: ${detail}` }, { status: 502 });
  }
  const task = await res.json();
  if (!task.id) {
    await refund(sb, cost);
    return NextResponse.json({ error: "Model returned no task" }, { status: 502 });
  }
  await sb.from("generations").insert({
    ...baseRow,
    status: "rendering",
    progress: 5,
    task_id: task.id,
    poster_url: typeof body.posterUrl === "string" ? body.posterUrl : null,
  });
  return NextResponse.json({ status: "rendering", taskId: task.id, credits: balance, cost });
}

export async function GET(req: Request) {
  const sb = userClient(req);
  if (!sb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { data: row, error } = await sb.from("generations").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.status !== "rendering" || !row.task_id) {
    return NextResponse.json({
      status: row.status,
      videoUrl: row.video_url,
      posterUrl: row.poster_url,
      error: row.error,
    });
  }

  const poll = await fetch(`${ARK_BASE}/contents/generations/tasks/${row.task_id}`, { headers: arkHeaders() });
  if (!poll.ok) return NextResponse.json({ status: "rendering" });
  const task = await poll.json();

  if (task.status === "succeeded") {
    const tmpUrl = task.content?.video_url;
    if (!tmpUrl) {
      return NextResponse.json({ status: "rendering" });
    }
    // Ark URLs expire (~24h) — persist the file into our own storage now.
    const download = await fetch(tmpUrl);
    if (!download.ok) return NextResponse.json({ status: "rendering" });
    const publicUrl = await storeFile(sb, user.id, `gen-${id}.mp4`, await download.arrayBuffer(), "video/mp4");
    if (!publicUrl) return NextResponse.json({ status: "rendering" });
    await sb.from("generations").update({ status: "succeeded", progress: 100, video_url: publicUrl }).eq("id", id);
    return NextResponse.json({ status: "succeeded", videoUrl: publicUrl, posterUrl: row.poster_url });
  }

  if (task.status === "failed" || task.status === "cancelled") {
    const message = JSON.stringify(task.error ?? task.status).slice(0, 300);
    await sb.from("generations").update({ status: "failed", progress: 100, error: message }).eq("id", id);
    await refund(sb, row.credits_cost ?? 0);
    const { data: balance } = await sb.rpc("adjust_credits", { delta: 0 });
    return NextResponse.json({ status: "failed", error: message, credits: balance ?? undefined });
  }

  return NextResponse.json({ status: "rendering" });
}
