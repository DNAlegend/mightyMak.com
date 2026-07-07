// MamoPay webhook — grants credits after a verified payment.
//
// The real security is NOT the shared secret (which the merchant may or may not
// have added to the registered URL) — it's that we re-fetch the charge from
// MamoPay with our own key and only credit a purchase that: (a) truly shows as
// captured, (b) matches a pending purchase WE created for a specific user, and
// (c) has the amount we recorded. A forged call can't satisfy that. So the
// secret is treated as a soft signal (logged), never a hard gate — this way a
// correctly-paid customer is never denied credits over a URL-secret mismatch.
// Credits are granted through settle_charge(), idempotent on the charge id, so
// replays and monthly renewals each credit exactly once.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCharge, chargeSucceeded, mamoConfigured } from "@/lib/mamopay";

export const maxDuration = 20;

/** Dig a value out of the (loosely-documented) webhook body from several spots. */
function pick(body: Record<string, unknown>, keys: string[]): string | null {
  const data = (body.data as Record<string, unknown>) ?? {};
  const custom = ((body.custom_data ?? data.custom_data) as Record<string, unknown>) ?? {};
  for (const k of keys) {
    const v = body[k] ?? data[k] ?? custom[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export async function POST(req: Request) {
  if (!mamoConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }
  // Soft secret signal (never a hard gate — see header comment).
  const secret = process.env.MAMOPAY_WEBHOOK_SECRET;
  const url = new URL(req.url);
  const provided = url.searchParams.get("key") ?? req.headers.get("authorization") ?? "";
  const secretOk = !secret || provided === secret || provided === `Bearer ${secret}`;
  if (!secretOk) console.warn("[mamo webhook] secret did not match — verifying via charge anyway");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("[mamo webhook] event:", JSON.stringify(body).slice(0, 600));
  const chargeId = pick(body, ["id", "charge_id", "chargeId", "transaction_id", "transactionId"]);
  if (!chargeId) {
    console.warn("[mamo webhook] no charge id in body:", JSON.stringify(body).slice(0, 500));
    return NextResponse.json({ ok: true }); // ack so MamoPay stops retrying a non-charge event
  }

  // Layer 2: authoritative re-fetch.
  const charge = await getCharge(chargeId);
  if (!charge || !chargeSucceeded(charge.status)) {
    return NextResponse.json({ ok: true }); // not a completed payment — ignore
  }

  const purchaseId =
    charge.custom_data?.purchase_id ??
    charge.external_id ??
    pick(body, ["external_id", "purchase_id"]);
  if (!purchaseId) {
    console.warn("[mamo webhook] no purchase id for charge", chargeId);
    return NextResponse.json({ ok: true });
  }

  const { data: purchase } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, user_id, credits, amount")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) {
    console.warn("[mamo webhook] unknown purchase", purchaseId);
    return NextResponse.json({ ok: true });
  }

  // Amount must match what we recorded — guards against tampering or mismatch.
  if (Math.abs(Number(charge.amount) - Number(purchase.amount)) > 0.01) {
    console.warn(`[mamo webhook] amount mismatch: charge ${charge.amount} vs purchase ${purchase.amount}`);
    return NextResponse.json({ ok: true });
  }

  // Layer 3: idempotent grant (also updates the balance atomically).
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
