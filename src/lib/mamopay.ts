import "server-only";

// MamoPay (mamopay.com) server helper. Docs: https://mamopay.readme.io/reference
// The API key stays server-side; set MAMOPAY_API_KEY in Vercel. Default is the
// sandbox — set MAMOPAY_ENV=production to charge for real.

const PROD_BASE = "https://business.mamopay.com/manage_api/v1";
const SANDBOX_BASE = "https://sandbox.dev.business.mamopay.com/manage_api/v1";

export function mamoBase(): string {
  return process.env.MAMOPAY_ENV === "production" ? PROD_BASE : SANDBOX_BASE;
}

export function mamoConfigured(): boolean {
  return !!process.env.MAMOPAY_API_KEY;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${process.env.MAMOPAY_API_KEY}`,
  };
}

export interface CreateLinkInput {
  title: string;
  amount: number;
  currency: string;
  returnUrl: string;
  failureUrl: string;
  /** Our purchase id — echoed back so the webhook can find the purchase. */
  externalId: string;
  customData: Record<string, string>;
  /** When set, MamoPay creates a recurring subscription link. */
  subscription?: { frequency: "monthly" | "weekly" | "annually"; frequency_interval: number };
}

/** Create a hosted payment (or subscription) link. Returns { id, payment_url }. */
export async function createPaymentLink(
  input: CreateLinkInput,
): Promise<{ id: string; paymentUrl: string } | { error: string }> {
  const body: Record<string, unknown> = {
    title: input.title.slice(0, 50),
    amount: input.amount,
    amount_currency: input.currency,
    return_url: input.returnUrl,
    failure_return_url: input.failureUrl,
    external_id: input.externalId,
    custom_data: input.customData,
    enable_customer_details: true,
    send_customer_receipt: true,
  };
  if (input.subscription) body.subscription = input.subscription;

  const res = await fetch(`${mamoBase()}/links`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.payment_url) {
    return { error: json?.error_message ?? json?.message ?? `MamoPay error (${res.status})` };
  }
  return { id: String(json.id), paymentUrl: String(json.payment_url) };
}

export interface MamoCharge {
  id: string;
  status: string;
  amount: number;
  amount_currency: string;
  custom_data?: Record<string, string>;
  external_id?: string;
}

/** Authoritatively re-fetch a charge to verify a webhook before granting credits. */
export async function getCharge(chargeId: string): Promise<MamoCharge | null> {
  const res = await fetch(`${mamoBase()}/charges/${encodeURIComponent(chargeId)}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MamoCharge | null;
}

/** MamoPay marks a completed one-off or subscription charge as "captured". */
export function chargeSucceeded(status?: string): boolean {
  return status === "captured" || status === "succeeded" || status === "paid";
}
