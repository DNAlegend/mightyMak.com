import "server-only";
import Stripe from "stripe";
import { billingItem, planVariant, type BillingItem } from "@/lib/billing";

// Stripe — our payment processor (TAXNOW FZE account). Everything happens on
// vibvid.ai: we mount Stripe's Embedded Checkout in-page (no redirect to a
// Stripe-hosted page), price it server-side from the billing catalog (so a
// browser can never swap in a cheaper amount), and grant credits from the
// webhook once Stripe reports the payment. Card data is entered into Stripe's
// own iframe fields — our server never touches raw card numbers.
//
// Config (set in Vercel, Production + Preview):
//   STRIPE_SECRET_KEY               secret key (Developers → API keys) — server only
//   STRIPE_WEBHOOK_SECRET           signing secret of the /api/stripe/webhook endpoint
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  publishable key (public) — used by the browser

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  return client;
}

/** Inline price_data for one catalog item — the single source of what a charge costs. */
function priceDataFor(item: BillingItem): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
  const isSubscription = item.kind === "subscription";
  const interval = item.interval ?? "month";
  return {
    currency: item.currency.toLowerCase(),
    unit_amount: Math.round(item.amount * 100),
    ...(isSubscription ? { recurring: { interval } } : {}),
    product_data: {
      name: `VIBVID ${item.label}${isSubscription && interval === "year" ? " (annual)" : ""}`,
      description: `${item.credits.toLocaleString()} credits${
        isSubscription ? (interval === "year" ? " / year" : " / month") : ""
      }`,
    },
  };
}

/**
 * Get the user's Stripe customer id, creating one if they don't have it yet.
 * Attaching every purchase to a single customer is what lets the account page
 * later list invoices, change the plan, and update the card.
 */
export async function ensureStripeCustomer(opts: {
  existingId: string | null;
  userId: string;
  email?: string | null;
}): Promise<string> {
  if (opts.existingId) return opts.existingId;
  const customer = await stripe().customers.create({
    ...(opts.email ? { email: opts.email } : {}),
    metadata: { user_id: opts.userId },
  });
  return customer.id;
}

/**
 * Create an Embedded Checkout Session for one billing item and return its
 * client secret (the browser mounts it with EmbeddedCheckoutProvider — no
 * redirect). Subscriptions run in `subscription` mode with a recurring inline
 * price; top-ups run in one-off `payment` mode. purchase_id / user_id /
 * item_id travel in the session metadata AND (for subs) the subscription
 * metadata, so the webhook can tie each charge and renewal back to us.
 */
export async function createEmbeddedCheckout(opts: {
  item: BillingItem;
  purchaseId: string;
  userId: string;
  customerId: string;
  origin: string;
}): Promise<{ id: string; clientSecret: string }> {
  const { item, purchaseId, userId, customerId, origin } = opts;
  const isSubscription = item.kind === "subscription";
  const meta = { purchase_id: purchaseId, user_id: userId, item_id: item.id };

  const session = await stripe().checkout.sessions.create({
    // "embedded_page" = Stripe.js in-page embedded checkout (renamed from
    // "embedded" in the current API version); returns a client_secret to mount.
    ui_mode: "embedded_page",
    mode: isSubscription ? "subscription" : "payment",
    customer: customerId,
    client_reference_id: purchaseId,
    line_items: [{ quantity: 1, price_data: priceDataFor(item) }],
    metadata: meta,
    ...(isSubscription ? { subscription_data: { metadata: meta } } : {}),
    // Embedded Checkout returns the buyer to our own page when done.
    return_url: `${origin}/app?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.client_secret) throw new Error("Stripe did not return a client secret");
  return { id: session.id, clientSecret: session.client_secret };
}

/**
 * Verify a Stripe webhook delivery against the endpoint's signing secret.
 * Returns the parsed event, or null on any missing/invalid signature —
 * callers reject with 401 rather than throwing.
 */
export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/**
 * Pull the subscription id + our metadata off an invoice. Stripe moved this
 * shape across API versions — the webhook endpoint can deliver an older shape
 * (top-level `subscription`) than the SDK we call with (`parent.…`) — so we
 * check every known location for the subscription id, then always resolve the
 * metadata by retrieving the subscription live (authoritative and
 * version-independent). Reading live metadata is also correct after a plan
 * switch: it reflects the current plan the next cycle should be credited for.
 */
export async function invoiceSubscriptionInfo(
  invoice: Stripe.Invoice
): Promise<{ subscriptionId: string | null; metadata: Record<string, string> }> {
  const inv = invoice as unknown as {
    parent?: { subscription_details?: { metadata?: Record<string, string>; subscription?: string | { id: string } } };
    subscription_details?: { metadata?: Record<string, string> };
    subscription?: string | { id: string };
    lines?: { data?: Array<{ subscription?: string | { id: string } | null; parent?: { subscription_item_details?: { subscription?: string | { id: string } } } }> };
  };
  const asId = (r: string | { id: string } | null | undefined): string | null =>
    typeof r === "string" ? r : r?.id ?? null;

  // Try every place the subscription id can live, across API versions.
  const line = inv.lines?.data?.[0];
  const subId =
    asId(inv.parent?.subscription_details?.subscription) ??
    asId(inv.subscription) ??
    asId(line?.parent?.subscription_item_details?.subscription) ??
    asId(line?.subscription);

  // Prefer live subscription metadata (authoritative, version-independent).
  if (subId) {
    try {
      const sub = await stripe().subscriptions.retrieve(subId);
      const meta = (sub.metadata ?? {}) as Record<string, string>;
      if (meta.item_id || meta.purchase_id) return { subscriptionId: subId, metadata: meta };
    } catch {
      /* fall through to the invoice snapshot */
    }
  }
  const direct = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
  if (direct?.item_id || direct?.purchase_id) return { subscriptionId: subId, metadata: direct };
  if (subId) {
    try {
      const sub = await stripe().subscriptions.retrieve(subId);
      return { subscriptionId: subId, metadata: (sub.metadata ?? {}) as Record<string, string> };
    } catch {
      /* fall through */
    }
  }
  return { subscriptionId: subId, metadata: {} };
}

// -------------------------------------------------------------- metrics ---
// Revenue metrics for the owner dashboard, computed live from Stripe.

export interface Subscriber {
  customerId: string;
  itemId: string | null;
  label: string;
  interval: "month" | "year" | null;
  mrrCents: number;
  status: string;
  startedAt: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

export interface RevenueMetrics {
  mrrCents: number;
  arrCents: number;
  activeSubscribers: number;
  pastDue: number;
  scheduledCancels: number;
  canceled30d: number;
  churnRate: number; // 0..1, trailing 30-day
  subscribers: Subscriber[];
  truncated: boolean; // true if we hit the page cap (>100 of a status)
}

/** Normalize one subscription to monthly recurring cents. */
function subMrrCents(sub: Stripe.Subscription): { cents: number; interval: "month" | "year" | null; itemId: string | null; label: string } {
  const item = sub.items.data[0];
  const price = item?.price;
  const unit = price?.unit_amount ?? 0;
  const count = price?.recurring?.interval_count ?? 1;
  const interval = (price?.recurring?.interval as "month" | "year" | undefined) ?? null;
  const perMonth = interval === "year" ? unit / (12 * count) : interval === "month" ? unit / count : 0;
  const itemId = sub.metadata?.item_id ?? null;
  const catalog = itemId ? billingItem(itemId) : null;
  return { cents: Math.round(perMonth), interval, itemId, label: catalog?.label ?? "Subscription" };
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const s = stripe();
  const CAP = 100;
  const [active, pastDue, canceled] = await Promise.all([
    s.subscriptions.list({ status: "active", limit: CAP }),
    s.subscriptions.list({ status: "past_due", limit: CAP }),
    s.subscriptions.list({ status: "canceled", limit: CAP }),
  ]);

  const paying = [...active.data, ...pastDue.data];
  let mrrCents = 0;
  let scheduledCancels = 0;
  const subscribers: Subscriber[] = paying.map((sub) => {
    const { cents, interval, itemId, label } = subMrrCents(sub);
    mrrCents += cents;
    if (sub.cancel_at_period_end) scheduledCancels += 1;
    const item = sub.items.data[0] as unknown as { current_period_end?: number } | undefined;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
    return {
      customerId,
      itemId,
      label,
      interval,
      mrrCents: cents,
      status: sub.status,
      startedAt: sub.start_date ?? sub.created ?? null,
      currentPeriodEnd: item?.current_period_end ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    };
  });
  subscribers.sort((a, b) => b.mrrCents - a.mrrCents);

  // Trailing-30-day churn: subscriptions canceled in the window over the base
  // that existed at the window's start (active-now + those that churned).
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
  const canceled30d = canceled.data.filter((sub) => (sub.canceled_at ?? sub.ended_at ?? 0) >= cutoff).length;
  const activeSubscribers = active.data.length + pastDue.data.length;
  const base = activeSubscribers + canceled30d;
  const churnRate = base > 0 ? canceled30d / base : 0;

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeSubscribers,
    pastDue: pastDue.data.length,
    scheduledCancels,
    canceled30d,
    churnRate,
    subscribers,
    truncated: active.has_more || pastDue.has_more || canceled.has_more,
  };
}

// ---------------------------------------------------------------- account ---
// Read + mutate a customer's subscription from our own account page.

export interface BillingOverview {
  plan: { itemId: string; label: string; interval: "month" | "year"; priceLabel: string; credits: number } | null;
  status: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  invoices: { id: string; date: number; amount: number; currency: string; status: string; url: string | null }[];
}

/** Everything the account page shows, fetched live from Stripe. */
export async function getBillingOverview(customerId: string): Promise<BillingOverview> {
  const s = stripe();
  const [subs, invoices, customer] = await Promise.all([
    s.subscriptions.list({ customer: customerId, status: "all", limit: 3, expand: ["data.default_payment_method"] }),
    s.invoices.list({ customer: customerId, limit: 12 }),
    s.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] }),
  ]);

  // The live subscription (active/trialing/past_due), else the most recent.
  const sub =
    subs.data.find((x) => ["active", "trialing", "past_due", "unpaid"].includes(x.status)) ?? subs.data[0] ?? null;

  const itemId = sub?.metadata?.item_id ?? null;
  const catalogItem = itemId ? billingItem(itemId) : null;

  // Card: the subscription's own PM, else the customer default.
  let pm = sub?.default_payment_method as Stripe.PaymentMethod | null | undefined;
  if (!pm || typeof pm === "string") {
    const cust = customer as Stripe.Customer;
    const dp = cust.invoice_settings?.default_payment_method;
    pm = dp && typeof dp !== "string" ? (dp as Stripe.PaymentMethod) : null;
  }
  const card = pm?.card ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year } : null;

  // In the current API version the period end lives on the subscription item,
  // not the subscription itself.
  const item = sub?.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;

  return {
    plan: catalogItem
      ? {
          itemId: catalogItem.id,
          label: catalogItem.label,
          interval: catalogItem.interval ?? "month",
          priceLabel: catalogItem.priceLabel,
          credits: catalogItem.credits,
        }
      : null,
    status: sub?.status ?? null,
    currentPeriodEnd: item?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    card,
    invoices: invoices.data.map((i) => ({
      id: i.id ?? "",
      date: i.created,
      amount: i.amount_paid,
      currency: i.currency,
      status: i.status ?? "",
      url: i.hosted_invoice_url ?? null,
    })),
  };
}

/** The live (manageable) subscription for a customer, or null. */
async function liveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 3 });
  return subs.data.find((x) => ["active", "trialing", "past_due", "unpaid"].includes(x.status)) ?? null;
}

/** Cancel at period end (they keep access until the paid period runs out), or undo that. */
export async function setCancelAtPeriodEnd(customerId: string, cancel: boolean): Promise<void> {
  const sub = await liveSubscription(customerId);
  if (!sub) throw new Error("No active subscription to change.");
  await stripe().subscriptions.update(sub.id, { cancel_at_period_end: cancel });
}

/**
 * Switch the subscription to a different plan/interval, effective at the next
 * renewal. We use proration_behavior "none" on purpose: with prorations, Stripe
 * folds the adjustment into the NEXT subscription_cycle invoice, whose total
 * would no longer equal the catalog price — and the webhook's exact-amount
 * check would then reject that renewal and grant no credits for a paid cycle.
 * "none" keeps every renewal invoice exactly the plan price, so credits always
 * settle. Metadata is updated so the next grant uses the new plan's credits.
 */
export async function switchPlan(customerId: string, userId: string, newItemId: string): Promise<void> {
  const target = billingItem(newItemId);
  if (!target || target.kind !== "subscription") throw new Error("Not a valid plan.");
  const sub = await liveSubscription(customerId);
  if (!sub) throw new Error("No active subscription to change.");
  if (sub.metadata?.item_id === target.id) return; // already on it

  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no billable item.");
  const meta = { purchase_id: sub.metadata?.purchase_id ?? "", user_id: userId, item_id: target.id };

  await stripe().subscriptions.update(sub.id, {
    items: [{ id: itemId, price_data: priceDataFor(target) as Stripe.SubscriptionUpdateParams.Item.PriceData }],
    proration_behavior: "none",
    metadata: meta,
  });
}

/** Begin a card update: a SetupIntent the browser confirms with the Payment Element. */
export async function createCardSetupIntent(customerId: string): Promise<string> {
  const si = await stripe().setupIntents.create({ customer: customerId, usage: "off_session" });
  if (!si.client_secret) throw new Error("Could not start card update.");
  return si.client_secret;
}

/** Make a just-added card the default for future invoices and the subscription. */
export async function setDefaultCard(customerId: string, paymentMethodId: string): Promise<void> {
  const s = stripe();
  await s.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  const sub = await liveSubscription(customerId);
  if (sub) await s.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
}

/** Resolve the catalog item a subscription is currently on (for webhook grants). */
export function planFromSubscriptionMeta(metadata: Record<string, string>): BillingItem | null {
  const itemId = metadata?.item_id;
  if (!itemId) return null;
  return billingItem(itemId) ?? planVariant(itemId, "month");
}
