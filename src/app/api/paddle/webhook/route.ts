// Paddle webhook — grants credits after a verified payment.
//
// Security model: we (1) verify Paddle's signature
// over the raw body, then (2) only credit a purchase that matches a pending
// purchase WE created, for a specific user, at the amount we recorded. Credits
// are granted through settle_charge(), idempotent on the Paddle transaction id,
// so replays and each monthly subscription renewal credit exactly once.
//
// Point a Paddle "notification destination" at /api/paddle/webhook and subscribe
// to transaction.completed (and, optionally, transaction.paid).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPaddleSignature, transactionSucceeded } from "@/lib/paddle";

export const maxDuration = 20;

// Paddle amounts arrive as integer minor-unit strings ("4900" = $49.00).
function minorUnits(major: number): number {
  return Math.round(major * 100);
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  // Verify against the RAW body — re-serialising would change the bytes Paddle signed.
  const raw = await req.text();
  const sig = req.headers.get("paddle-signature");
  if (!verifyPaddleSignature(raw, sig)) {
    console.warn("[paddle webhook] signature verification failed");
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const event = JSON.parse(raw || "{}") as {
    event_type?: string;
    data?: {
      id?: string;
      status?: string;
      currency_code?: string;
      custom_data?: Record<string, unknown> | null;
      details?: { totals?: { total?: string; grand_total?: string } };
    };
  };

  const type = event.event_type ?? "";
  if (type !== "transaction.completed" && type !== "transaction.paid") {
    return NextResponse.json({ ok: true }); // ack unrelated events so Paddle stops retrying
  }

  const data = event.data ?? {};
  const txnId = data.id;
  if (!txnId || !transactionSucceeded(data.status)) {
    return NextResponse.json({ ok: true });
  }

  const purchaseId =
    (data.custom_data?.purchase_id as string | undefined) ?? undefined;
  if (!purchaseId) {
    console.warn("[paddle webhook] no purchase_id in custom_data for txn", txnId);
    return NextResponse.json({ ok: true });
  }

  const { data: purchase } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, user_id, credits, amount, currency")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) {
    console.warn("[paddle webhook] unknown purchase", purchaseId);
    return NextResponse.json({ ok: true });
  }

  // Amount + currency must match what we recorded — guards against tampering.
  const paidTotal = Number(data.details?.totals?.total ?? data.details?.totals?.grand_total ?? "0");
  if (Math.abs(paidTotal - minorUnits(Number(purchase.amount))) > 1) {
    console.warn(
      `[paddle webhook] amount mismatch: paid ${paidTotal} vs expected ${minorUnits(Number(purchase.amount))}`,
    );
    return NextResponse.json({ ok: true });
  }
  if ((data.currency_code ?? "USD") !== (purchase.currency ?? "USD")) {
    console.warn(`[paddle webhook] currency mismatch: ${data.currency_code} vs ${purchase.currency}`);
    return NextResponse.json({ ok: true });
  }

  // Idempotent grant, keyed on the Paddle transaction id (unique per charge and
  // per renewal), so each billing period credits exactly once.
  const { data: granted, error } = await supabaseAdmin.rpc("settle_charge", {
    p_charge_id: txnId,
    p_purchase_id: purchase.id,
    p_user: purchase.user_id,
    p_credits: purchase.credits,
  });
  if (error) {
    console.error("[paddle webhook] settle_charge failed:", error.message);
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credited: granted === true });
}
