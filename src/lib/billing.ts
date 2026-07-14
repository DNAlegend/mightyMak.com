// Billing catalog — the single source of truth for what can be purchased.
// The client renders these; the server (/api/checkout) looks the amount and
// credits up here by id, so the price a user pays is never client-controlled.
//
// Pricing is credit-based and internal on purpose: customers spend VIBVID
// credits, never a raw provider cost, so our margin and model mix stay ours.
// See docs at the bottom for the credit economics.

export interface BillingItem {
  id: string;
  label: string;
  kind: "topup" | "subscription";
  /** Credits granted per successful charge (per month, for subscriptions). */
  credits: number;
  /** Price in major units of `currency` (e.g. 19 = $19.00). */
  amount: number;
  /** Charge currency. USD today; AED shown alongside for the UAE market. */
  currency: "USD";
  priceLabel: string;
  /** Secondary price shown for the local market (display only). */
  aedLabel?: string;
  sublabel: string;
  popular?: boolean;
  /** Top-up credits expire this many months after purchase (subscription credits reset monthly). */
  expiresMonths?: number;
}

/**
 * One-off credit packs — "buy more as you need". Priced a touch above the
 * subscription rate ($0.05–0.075 / credit) so upgrading always looks better.
 * Packs expire after 12 months.
 */
export const TOPUPS: BillingItem[] = [
  { id: "topup-200", label: "Starter", kind: "topup", credits: 200, amount: 15, currency: "USD", priceLabel: "$15", aedLabel: "AED 55", sublabel: "≈ 2 Full-HD clips (5s each)", expiresMonths: 12 },
  { id: "topup-600", label: "Popular", kind: "topup", credits: 600, amount: 39, currency: "USD", priceLabel: "$39", aedLabel: "AED 143", sublabel: "≈ 6 Full-HD clips (5s each)", popular: true, expiresMonths: 12 },
  { id: "topup-1500", label: "Value", kind: "topup", credits: 1500, amount: 89, currency: "USD", priceLabel: "$89", aedLabel: "AED 327", sublabel: "≈ 16 Full-HD clips (5s each)", expiresMonths: 12 },
  { id: "topup-5000", label: "Bulk", kind: "topup", credits: 5000, amount: 249, currency: "USD", priceLabel: "$249", aedLabel: "AED 915", sublabel: "≈ 55 Full-HD clips (5s each)", expiresMonths: 12 },
];

/**
 * Monthly subscription plans. Credits reset each billing cycle. Sublabels are
 * honest against the credit rates in models.ts — a 5s 1080p (Full HD, native
 * audio) Production render is ~90 credits, a 5s 720p HD render ~45, a standard
 * image ~3. Higher tiers (4K ~200/5s) cost more. No unlimited tier at launch:
 * generation cost is variable, so every plan is a fixed credit budget.
 */
export const PLAN_ITEMS: BillingItem[] = [
  { id: "plan-creator", label: "Creator", kind: "subscription", credits: 300, amount: 19, currency: "USD", priceLabel: "$19", aedLabel: "AED 69", sublabel: "≈ 3 Full-HD clips (5s each) or 6 in HD / mo" },
  { id: "plan-pro", label: "Pro", kind: "subscription", credits: 1000, amount: 49, currency: "USD", priceLabel: "$49", aedLabel: "AED 179", sublabel: "≈ 11 Full-HD clips (5s each) or 22 HD / mo", popular: true },
  { id: "plan-agency", label: "Agency", kind: "subscription", credits: 3000, amount: 129, currency: "USD", priceLabel: "$129", aedLabel: "AED 475", sublabel: "≈ 33 Full-HD clips (5s each) or 66 HD / mo" },
];

export const BILLING_ITEMS: BillingItem[] = [...TOPUPS, ...PLAN_ITEMS];

export function billingItem(id: string): BillingItem | null {
  return BILLING_ITEMS.find((i) => i.id === id) ?? null;
}

/** New accounts start here — enough to try the platform, watermarked. */
export const FREE_CREDITS = 20;
