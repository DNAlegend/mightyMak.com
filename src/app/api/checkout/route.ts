// Start an on-site checkout for a top-up pack or a subscription plan.
// Records a pending purchase (server-priced from the billing catalog — never
// trusts the client's amount), ensures the user has a Stripe customer, then
// creates an Embedded Checkout Session and returns its client secret. The
// browser mounts Stripe's payment form in-page — no redirect. VIBVID.AI is the
// seller; we never touch card data.
//
// Two ways in: a signed-in caller (Authorization header), or a guest with just
// an email — we create their account server-side so they can pay first and
// confirm the account after payment.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromRequest, userIdForEmail } from "@/lib/supabase-admin";
import { getBillingCustomer, saveBillingCustomer } from "@/lib/billing-customer";
import { billingItem } from "@/lib/billing";
import { stripeConfigured, createEmbeddedCheckout, ensureStripeCustomer } from "@/lib/stripe";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!stripeConfigured() || !supabaseAdmin) {
    // Stripe not wired up — the client falls back to demo credits (local only).
    return NextResponse.json({ error: "Payments not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const item = billingItem(typeof body?.itemId === "string" ? body.itemId : "");
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // Where Embedded Checkout returns the buyer once done — always our own site.
  const origin =
    req.headers.get("origin") ??
    (typeof body?.origin === "string" ? body.origin : new URL(req.url).origin);

  let userId = await userIdFromRequest(req);
  let customerEmail: string | null = null;
  if (userId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    customerEmail = data.user?.email ?? null;
  } else {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter your email to continue" }, { status: 401 });
    }
    userId = await userIdForEmail(email);
    if (!userId) {
      return NextResponse.json({ error: "Could not set up your account" }, { status: 500 });
    }
    customerEmail = email;
  }

  // Ensure the user has one Stripe customer so every purchase, invoice and
  // saved card lives together (the account page manages them there).
  const existing = await getBillingCustomer(userId);
  let customerId: string;
  try {
    customerId = await ensureStripeCustomer({
      existingId: existing?.customerId ?? null,
      userId,
      email: customerEmail,
    });
    if (!existing) await saveBillingCustomer(userId, customerId);
  } catch (e) {
    console.error("[checkout] customer setup failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }

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

  try {
    const session = await createEmbeddedCheckout({
      item,
      purchaseId: purchase.id,
      userId,
      customerId,
      origin,
    });
    return NextResponse.json({
      provider: "stripe",
      purchaseId: purchase.id,
      clientSecret: session.clientSecret,
    });
  } catch (e) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    console.error("[checkout] Stripe session creation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
