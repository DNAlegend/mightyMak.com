// Mamo webhook — grants credits after a verified payment.
//
// Security model: we (1) verify the shared secret Mamo echoes in the
// Authorization header (set as the webhook's auth_header when registering it),
// then (2) only credit a purchase that matches a pending purchase WE created,
// for a specific user, at the amount we recorded. Credits are granted through
// settle_charge(), idempotent on Mamo's charge id — which is unique per charge
// and per subscription renewal — so replays and each monthly renewal credit
// exactly once.
//
// Register a webhook (dashboard → Developer → Webhooks, or the API) pointing at
// /api/mamo/webhook, subscribed to charge.succeeded and subscription.succeeded,
// with the auth header set to MAMO_WEBHOOK_SECRET.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyMamoWebhook, chargeCaptured, MAMO_SUCCESS_EVENTS } from "@/lib/mamo";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const raw = await req.text();
  if (!verifyMamoWebhook(req.headers.get("authorization"))) {
    console.warn("[mamo webhook] auth verification failed");
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  // Mamo posts a flat charge object with an event_type field.
  const event = JSON.parse(raw || "{}") as {
    event_type?: string;
    id?: string;
    status?: string;
    amount?: number | string;
    amount_currency?: string;
    external_id?: string | null;
    subscription_id?: string | null;
    custom_data?: Record<string, unknown> | null;
  };

  const type = event.event_type ?? "";
  if (!MAMO_SUCCESS_EVENTS.includes(type as (typeof MAMO_SUCCESS_EVENTS)[number])) {
    return NextResponse.json({ ok: true }); // ack unrelated events so Mamo stops retrying
  }

  const chargeId = event.id;
  if (!chargeId || !chargeCaptured(event.status)) {
    return NextResponse.json({ ok: true });
  }

  const purchaseId =
    (event.custom_data?.purchase_id as string | undefined) ?? event.external_id ?? undefined;
  if (!purchaseId) {
    console.warn("[mamo webhook] no purchase_id for charge", chargeId);
    return NextResponse.json({ ok: true });
  }

  const { data: purchase } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, user_id, credits, amount, currency")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) {
    console.warn("[mamo webhook] unknown purchase", purchaseId);
    return NextResponse.json({ ok: true });
  }

  // Amount + currency must match what we recorded — guards against tampering.
  // Mamo sends the amount in major units (e.g. 49.0), same as we store it.
  const paid = Number(event.amount ?? 0);
  if (Math.abs(paid - Number(purchase.amount)) > 0.5) {
    console.warn(`[mamo webhook] amount mismatch: paid ${paid} vs expected ${purchase.amount}`);
    return NextResponse.json({ ok: true });
  }
  if ((event.amount_currency ?? "USD") !== (purchase.currency ?? "USD")) {
    console.warn(`[mamo webhook] currency mismatch: ${event.amount_currency} vs ${purchase.currency}`);
    return NextResponse.json({ ok: true });
  }

  // Idempotent grant, keyed on the Mamo charge id (unique per charge and per
  // renewal), so each billing period credits exactly once.
  const { data: granted, error } = await supabaseAdmin.rpc("settle_charge", {
    p_charge_id: chargeId,
    p_purchase_id: purchase.id,
    p_user: purchase.user_id,
    p_credits: purchase.credits,
  });
  if (error) {
    console.error("[mamo webhook] settle_charge failed:", error.message);
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credited: granted === true });
}
