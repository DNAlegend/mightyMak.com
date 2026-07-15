# Stripe go-live checklist

VIBVID charges through **Stripe** (TAXNOW FZE account). Stripe handles the
hosted checkout, card processing and subscription renewals; VIBVID.AI™ is the
seller on the site. We never touch card data.

Pricing (from `src/lib/billing.ts` — the only source of truth):

| Plan    | Monthly       | Annual (4 months on us) |
| ------- | ------------- | ----------------------- |
| Creator | $19 · 300 cr  | $152 · 3,600 cr up front |
| Pro     | $39 · 800 cr  | $312 · 9,600 cr up front |
| Agency  | $69 · 1,500 cr| $552 · 18,000 cr up front |

Top-up packs: $15/200, $39/600, $89/1,500, $249/5,000 (one-off, valid 12 months).
No free tier, no trial.

## 1. No products to create in Stripe

Checkout Sessions are created server-side with **inline `price_data`** priced
from the billing catalog. You do not need to create Products or Prices in the
Stripe dashboard — nothing to keep in sync.

## 2. Environment variables (Vercel → Settings → Environment Variables)

```
STRIPE_SECRET_KEY=sk_live_…              # Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_…            # from step 3
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…  # Developers → API keys (public — safe to expose)
```

Set all three for **Production** (and Preview if you want to test with test-mode
keys there). The **publishable key is required** for the in-page (embedded)
checkout and the account page's card update to render. Until `STRIPE_SECRET_KEY`
is set, `/api/checkout` returns 501 and the site behaves as before (no checkout).

## 3. Register the webhook (Stripe dashboard)

Dashboard → **Developers → Webhooks → Add endpoint**:

- Endpoint URL: `https://www.vibvid.ai/api/stripe/webhook`
- Events: **`checkout.session.completed`**, **`invoice.paid`**, and
  **`checkout.session.async_payment_succeeded`** (covers delayed payment
  methods if you ever enable them; harmless otherwise)
- After creating it, copy the **Signing secret** (`whsec_…`) into
  `STRIPE_WEBHOOK_SECRET` in Vercel, then **redeploy**.

`checkout.session.completed` settles one-off top-ups; `invoice.paid` settles
the first subscription charge **and every renewal** (monthly or yearly).
Credits are granted idempotently per Stripe charge/invoice id via the existing
`settle_charge` RPC — replays and retries can never double-credit.

## 4. Apply the migrations (Supabase SQL editor, in this order)

1. `supabase/migrations/20260714200000_launch_hardening.sql` — rate limits,
   ToS timestamp, atomic failed-render refund (if not already applied).
2. `supabase/migrations/20260715120000_stripe_paid_only.sql` — new accounts
   start at 0 credits (paid only).
3. `supabase/migrations/20260715130000_lock_credit_writes.sql` — **important**:
   blocks clients from ever adding credits (previously a signed-in user could
   call `adjust_credits` with a positive delta or update their own
   `profiles.credits` row directly — a free-credits hole). Grants now flow only
   through the Stripe webhook and server-side refunds.
4. `supabase/migrations/20260716120000_billing_customers.sql` — stores each
   user's Stripe customer id so the on-site account page can list invoices,
   switch plan, cancel, and update the card.

## 5. Test end-to-end (test mode)

With `sk_test_…` + a test-mode webhook endpoint (same URL), buy a plan with
card `4242 4242 4242 4242`:

1. Pick a plan → redirected to Stripe Checkout → pay.
2. Redirected back to `/app?purchase=success`; the app polls until the
   webhook-granted credits appear.
3. Check Supabase: `credit_purchases` row flips to `paid`, `credit_charges`
   has one row per invoice, profile balance increased.
4. Swap in live keys + live webhook, make one real $15 top-up, refund it from
   the Stripe dashboard.

## 6. Account management is now on-site

Customers manage everything inside vibvid.ai (the person icon in the app
topbar → "Account & billing"): see their plan, credit balance, and invoices,
**cancel** (or resume) their plan, **switch** tier or monthly↔annual, and
**update their card** — all without leaving the site. You do **not** need
Stripe's hosted Customer Portal.

## 7. After launch (recommended)

- Set your **statement descriptor** (Settings → Public details) — cardholders
  will see the TAXNOW FZE account's descriptor; make it say VIBVID so
  chargebacks stay low.
- Turn on **Stripe Radar** default rules (on by default) and email receipts
  (Settings → Emails → send receipts to customers).
- **Do not enable Stripe Tax or coupons** without telling me first. Prices are
  verified against the exact catalog amount, so adding tax/discounts at
  checkout would make the amounts differ and credits would stop being granted.
  If you want tax or promos later, I'll adjust the verification to match.
