// One-time setup endpoint: registers the Mamo webhook using the API key that
// already lives in the server environment (MAMOPAY_API_KEY) — so the secret
// never leaves Vercel. Gated by a throwaway MAMO_SETUP_TOKEN. Safe to remove
// once the webhook is registered.
//
//   GET /api/mamo/setup?token=<MAMO_SETUP_TOKEN>[&url=https://www.vibvid.ai]
//
// Lists existing webhooks and, if none points at our handler, creates one for
// charge.succeeded + subscription.succeeded (+ their .failed) with the auth
// header set to MAMOPAY_WEBHOOK_SECRET. Never echoes any secret.

import { NextResponse } from "next/server";

const LIVE = "https://business.mamopay.com/manage_api/v1";
const SANDBOX = "https://sandbox.dev.business.mamopay.com/manage_api/v1";
const EVENTS = ["charge.succeeded", "subscription.succeeded", "charge.failed", "subscription.failed"];
const DEFAULT_SITE = "https://www.vibvid.ai";

export async function GET(req: Request) {
  // Gate on the existing webhook secret — no new secret, nothing hardcoded.
  // The caller proves ownership by passing the same MAMOPAY_WEBHOOK_SECRET that
  // is configured in the server environment. This whole route is removed once
  // the webhook is registered.
  const apiKey = process.env.MAMOPAY_API_KEY;
  const secret = process.env.MAMOPAY_WEBHOOK_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!apiKey) return NextResponse.json({ error: "MAMOPAY_API_KEY not set" }, { status: 500 });
  if (secret.length > 50) {
    return NextResponse.json(
      { error: `MAMOPAY_WEBHOOK_SECRET is ${secret.length} chars; Mamo allows max 50. Shorten it in Vercel and redeploy.` },
      { status: 400 },
    );
  }

  const env = process.env.MAMOPAY_ENV === "production" ? "production" : "sandbox";
  const base = env === "production" ? LIVE : SANDBOX;
  const site = (new URL(req.url).searchParams.get("url") ?? DEFAULT_SITE).replace(/\/$/, "");
  const webhookUrl = `${site}/api/mamo/webhook`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    // List existing webhooks.
    const listRes = await fetch(`${base}/webhooks/`, { headers, cache: "no-store" });
    const listText = await listRes.text();
    if (!listRes.ok) {
      return NextResponse.json(
        { error: `Mamo list failed (${listRes.status})`, detail: listText.slice(0, 300), env },
        { status: 502 },
      );
    }
    const parsed = listText ? JSON.parse(listText) : [];
    const existing = Array.isArray(parsed) ? parsed : parsed?.data ?? [];
    const summary = existing.map((w: { id?: string; url?: string }) => ({ id: w.id, url: w.url }));

    const match = existing.find((w: { url?: string }) => w.url === webhookUrl);
    if (match) {
      return NextResponse.json({ ok: true, alreadyRegistered: true, env, webhookUrl, id: match.id, webhooks: summary });
    }

    // Create it.
    const createRes = await fetch(`${base}/webhooks/`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ url: webhookUrl, enabled_events: EVENTS, auth_header: secret }),
    });
    const createText = await createRes.text();
    if (!createRes.ok) {
      return NextResponse.json(
        { error: `Mamo create failed (${createRes.status})`, detail: createText.slice(0, 300), env },
        { status: 502 },
      );
    }
    const created = createText ? JSON.parse(createText) : {};
    // Never echo auth_header.
    return NextResponse.json({
      ok: true,
      created: true,
      env,
      webhookUrl,
      id: created.id ?? null,
      events: created.enabled_events ?? EVENTS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "setup failed" },
      { status: 500 },
    );
  }
}
