import "server-only";
import crypto from "node:crypto";
import type { BillingItem } from "@/lib/billing";

// Mamo (Mamo Pay) — our payment processor. Unlike a merchant of record, Mamo
// only moves the money: VIBVID.AI remains the seller. We create a
// hosted payment link on the server (so a browser can never swap in a cheaper
// amount), redirect the buyer to Mamo's hosted checkout, and grant credits from
// the webhook once Mamo reports the charge "captured".
// Docs: https://mamopay.readme.io/reference/post_links
//
// Config (set in the environment / Vercel):
//   MAMOPAY_ENV             "sandbox" (default) or "production"
//   MAMOPAY_API_KEY         secret API key (Dashboard → Developer → API keys) — server only
//   MAMOPAY_WEBHOOK_SECRET  the auth_header value registered on the webhook; Mamo
//                           echoes it in the Authorization header of every delivery,
//                           which we verify in constant time.

const LIVE_BASE = "https://business.mamopay.com/manage_api/v1";
const SANDBOX_BASE = "https://sandbox.dev.business.mamopay.com/manage_api/v1";

export function mamoEnvironment(): "sandbox" | "production" {
  return process.env.MAMOPAY_ENV === "production" ? "production" : "sandbox";
}

/** True once the pieces needed to open a Mamo checkout are present. */
export function mamoConfigured(): boolean {
  return !!process.env.MAMOPAY_API_KEY;
}

function mamoBaseUrl(): string {
  return mamoEnvironment() === "production" ? LIVE_BASE : SANDBOX_BASE;
}

export interface MamoLink {
  /** Mamo payment-link id (kept for reference/debugging). */
  id: string;
  /** Hosted checkout URL to redirect the buyer to. */
  paymentUrl: string;
}

/**
 * Create a hosted Mamo payment link for one billing item and return its
 * checkout URL. Subscriptions get a monthly recurring config (credits refill
 * each cycle, one webhook per renewal); top-ups are single-use (capacity 1).
 * The purchase id travels in both `external_id` and `custom_data` so the
 * webhook can tie the resulting charge — and every renewal — back to it.
 */
export async function createMamoLink(opts: {
  item: BillingItem;
  purchaseId: string;
  origin: string;
  email?: string | null;
}): Promise<MamoLink> {
  const { item, purchaseId, origin, email } = opts;
  const isSubscription = item.kind === "subscription";

  const body: Record<string, unknown> = {
    title: `VIBVID ${item.label}`.slice(0, 50),
    description: `${item.credits.toLocaleString()} credits${isSubscription ? " / month" : ""}`.slice(0, 75),
    amount: Number(item.amount),
    amount_currency: item.currency, // "USD" — matches the billing catalog
    return_url: `${origin}/app?purchase=success`,
    failure_return_url: `${origin}/app?purchase=failed`,
    external_id: purchaseId,
    custom_data: { purchase_id: purchaseId },
    send_customer_receipt: true,
    enable_customer_details: true,
    ...(email ? { email } : {}),
    ...(isSubscription
      ? { subscription: { frequency: "monthly", frequency_interval: 1 } }
      : { capacity: 1 }),
  };

  const res = await fetch(`${mamoBaseUrl()}/links/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MAMOPAY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    // Never cache a checkout creation.
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Mamo link creation failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string; payment_url?: string };
  if (!data.id || !data.payment_url) {
    throw new Error("Mamo did not return a payment_url");
  }
  return { id: data.id, paymentUrl: data.payment_url };
}

/**
 * Verify a Mamo webhook. When the webhook is registered (dashboard or API) its
 * `auth_header` is set to MAMOPAY_WEBHOOK_SECRET; Mamo then sends that value in the
 * Authorization header on every delivery. We compare in constant time and
 * accept either the raw secret or a "Bearer <secret>" form. Returns false
 * (rather than throwing) on any malformed input.
 */
export function verifyMamoWebhook(authHeader: string | null): boolean {
  const secret = process.env.MAMOPAY_WEBHOOK_SECRET;
  if (!secret || !authHeader) return false;
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Mamo marks a fully-captured payment as "captured". */
export function chargeCaptured(status?: string): boolean {
  return status === "captured" || status === "succeeded";
}

/** Webhook event types that represent a successful (creditable) payment. */
export const MAMO_SUCCESS_EVENTS = ["charge.succeeded", "subscription.succeeded"] as const;
