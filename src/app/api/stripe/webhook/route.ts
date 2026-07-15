// Stripe webhook — grants credits after a verified payment.
//
// Security model: we (1) verify Stripe's signature on the raw body, then
// (2) only credit against the plan we priced server-side, at the amount Stripe
// reports. Credits are granted through settle_charge(), idempotent on the
// Stripe charge id — the payment intent for one-off packs, the invoice id for
// subscriptions — so replays and each renewal credit exactly once.
//
// Subscription credits are granted ONLY on full-period invoices
// (billing_reason subscription_create / subscription_cycle). Mid-cycle plan
// changes produce a `subscription_update` proration invoice, which we skip —
// the new plan's credits arrive at the next full cycle. This keeps switching
// plans from double-granting.
//
// Register the endpoint (Developers → Webhooks) at /api/stripe/webhook,
// subscribed to checkout.session.completed, checkout.session.async_payment_succeeded,
// and invoice.paid; set its signing secret as STRIPE_WEBHOOK_SECRET.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyStripeWebhook, invoiceSubscriptionInfo, planFromSubscriptionMeta } from "@/lib/stripe";
import { userForCustomer, saveBillingCustomer, saveSubscriptionId } from "@/lib/billing-customer";

export const maxDuration = 20;

/** Grant credits idempotently on a charge id. Returns true if this call credited. */
async function grant(chargeId: string, purchaseId: string | null, userId: string, credits: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin!.rpc("settle_charge", {
    p_charge_id: chargeId,
    p_purchase_id: purchaseId,
    p_user: userId,
    p_credits: credits,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const raw = await req.text();
  const event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) {
    console.warn("[stripe webhook] signature verification failed");
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

      // Keep our customer/subscription records in sync.
      if (userId && customerId) await saveBillingCustomer(userId, customerId);
      if (session.mode === "subscription") {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        if (userId) await saveSubscriptionId(userId, subId);
        // Subscriptions are credited from invoice.paid (first cycle + renewals).
        return NextResponse.json({ ok: true });
      }

      // One-off top-up: credit now, keyed on the payment intent.
      if (session.payment_status !== "paid") return NextResponse.json({ ok: true });
      const purchaseId = session.metadata?.purchase_id ?? session.client_reference_id ?? null;
      const chargeId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? session.id;
      if (!purchaseId) return NextResponse.json({ ok: true });

      const { data: purchase } = await supabaseAdmin
        .from("credit_purchases")
        .select("id, user_id, credits, amount, currency")
        .eq("id", purchaseId)
        .maybeSingle();
      if (!purchase) return NextResponse.json({ ok: true });

      const expectedCents = Math.round(Number(purchase.amount) * 100);
      if (session.amount_total !== expectedCents) {
        console.warn(`[stripe webhook] topup amount mismatch: ${session.amount_total} vs ${expectedCents}`);
        return NextResponse.json({ ok: true });
      }
      if ((session.currency ?? "usd").toUpperCase() !== (purchase.currency ?? "USD")) {
        return NextResponse.json({ ok: true });
      }
      const credited = await grant(chargeId, purchase.id, purchase.user_id, purchase.credits);
      return NextResponse.json({ ok: true, credited });
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.status !== "paid" || !invoice.id) return NextResponse.json({ ok: true });

      // Only full-period invoices grant credits — never a proration.
      const reason = invoice.billing_reason ?? "";
      if (reason !== "subscription_create" && reason !== "subscription_cycle") {
        return NextResponse.json({ ok: true });
      }

      const { subscriptionId, metadata } = await invoiceSubscriptionInfo(invoice);
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      const userId = metadata.user_id ?? (customerId ? await userForCustomer(customerId) : null);
      const plan = planFromSubscriptionMeta(metadata);
      if (!userId || !plan) {
        console.warn("[stripe webhook] invoice.paid missing user/plan", invoice.id);
        return NextResponse.json({ ok: true });
      }

      // Full-period charge must equal the plan's catalog price.
      const expectedCents = Math.round(plan.amount * 100);
      if (invoice.amount_paid !== expectedCents) {
        console.warn(`[stripe webhook] sub amount mismatch: ${invoice.amount_paid} vs ${expectedCents} (${plan.id})`);
        return NextResponse.json({ ok: true });
      }
      if ((invoice.currency ?? "usd").toUpperCase() !== plan.currency) {
        return NextResponse.json({ ok: true });
      }

      if (customerId) await saveBillingCustomer(userId, customerId);
      if (subscriptionId) await saveSubscriptionId(userId, subscriptionId);

      const purchaseId = metadata.purchase_id || null;
      const credited = await grant(invoice.id, purchaseId, userId, plan.credits);
      return NextResponse.json({ ok: true, credited });
    }
  } catch (e) {
    console.error("[stripe webhook] handler error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }); // ack unrelated events
}
