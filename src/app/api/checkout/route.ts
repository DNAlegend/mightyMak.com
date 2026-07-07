// Start a MamoPay checkout for a top-up pack or a subscription plan.
// Authenticates the caller, records a pending purchase (server-priced from the
// billing catalog — never trusts the client's amount), creates the MamoPay
// hosted link, and returns its URL for the browser to redirect to.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromRequest } from "@/lib/supabase-admin";
import { billingItem } from "@/lib/billing";
import { createPaymentLink, mamoConfigured } from "@/lib/mamopay";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!mamoConfigured() || !supabaseAdmin) {
    // No payment provider wired up — the client falls back to demo credits.
    return NextResponse.json({ error: "Payments not configured" }, { status: 501 });
  }
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const item = billingItem(typeof body?.itemId === "string" ? body.itemId : "");
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // The browser origin drives the return URLs so this works on any domain.
  const origin =
    (typeof body?.origin === "string" && /^https?:\/\//.test(body.origin) && body.origin) ||
    req.headers.get("origin") ||
    "https://mightymak.vercel.app";

  // Record the intent first so the webhook has something to reconcile against.
  const { data: purchase, error: insErr } = await supabaseAdmin
    .from("credit_purchases")
    .insert({
      user_id: userId,
      kind: item.kind,
      item: item.id,
      credits: item.credits,
      amount: item.amount,
      currency: item.currency,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !purchase) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const link = await createPaymentLink({
    title: item.kind === "subscription" ? `MightyMak ${item.label} plan` : `${item.credits} credits`,
    amount: item.amount,
    currency: item.currency,
    returnUrl: `${origin}/app?purchase=success`,
    failureUrl: `${origin}/app?purchase=failed`,
    externalId: purchase.id,
    customData: { purchase_id: purchase.id, user_id: userId, credits: String(item.credits) },
    subscription:
      item.kind === "subscription" ? { frequency: "monthly", frequency_interval: 1 } : undefined,
  });

  if ("error" in link) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return NextResponse.json({ error: link.error }, { status: 502 });
  }

  await supabaseAdmin
    .from("credit_purchases")
    .update({ mamo_link_id: link.id })
    .eq("id", purchase.id);

  return NextResponse.json({ url: link.paymentUrl });
}
