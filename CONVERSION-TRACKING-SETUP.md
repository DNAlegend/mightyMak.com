# VIBVID — Conversion Tracking Setup (Google Ads + Meta Conversions API)

Handoff instructions. **The code is already written, merged, and deployed**
(commit `a6d28a8`). Nothing needs to be built. This is purely an operational
setup: collect credentials, set environment variables, run one database
migration, and verify. A conversion = **someone becomes a paid subscriber**
(not a credit top-up).

---

## What the code already does (for context — do not re-implement)

When a user completes a **subscription** checkout, the app reports the
conversion two ways, deduplicated so it counts once:

1. **Browser side** (`src/lib/conversions.ts`, `src/components/analytics-tags.tsx`)
   - Google Ads: fires a `conversion` event via `gtag.js`.
   - Meta: fires a `Subscribe` event via the Meta Pixel.
2. **Server side** (`src/lib/meta-capi.ts`, called from the Stripe webhook
   `src/app/api/stripe/webhook/route.ts`)
   - Meta **Conversions API**: fires the same `Subscribe` event server-side on
     the first paid invoice of a new subscription. This catches conversions
     that ad blockers / iOS privacy hide from the browser pixel.

The browser pixel and the server CAPI event share the same `event_id` (the
purchase id), so **Meta automatically deduplicates them** — you will see one
conversion, not two. This is expected and correct.

**Every tag is env-gated:** if an environment variable below is not set, that
tag simply never loads or fires. Billing is never affected — credits are always
granted only by the verified Stripe webhook.

---

## Step 1 — Get the Google Ads credentials

1. Google Ads → **Goals → Conversions → Summary → + New conversion action**.
2. Choose **Website**, enter the domain (`vibvid.ai`).
3. Create a conversion action named e.g. **"Subscribe"**:
   - Category: **Purchase** (or "Sign-up" if you prefer; Purchase is standard).
   - Value: choose **"Use different values for each conversion"** (the app sends
     the plan's actual dollar value).
   - Count: **One** (one conversion per subscriber).
4. On the tag setup screen, choose **"Install the tag yourself"** → the event
   snippet shows a line like:
   ```js
   gtag('event', 'conversion', { 'send_to': 'AW-123456789/AbC-dEfGhIjK' });
   ```
   From that string you need two values:
   - **Conversion ID** = `AW-123456789` (the part before the slash)
   - **Conversion Label** = `AbC-dEfGhIjK` (the part after the slash)

> Do NOT paste the whole snippet anywhere — the app already renders gtag.js.
> You only need those two values as environment variables.

---

## Step 2 — Get the Meta credentials

1. Meta **Events Manager** → select (or create) your **Pixel / Dataset** for
   vibvid.ai.
2. **Pixel ID** — shown at the top of the data source (a ~15-digit number).
   This is public/safe to expose.
3. **Conversions API access token** — in the data source: **Settings →
   Conversions API → Generate access token**. This is a **secret** — treat it
   like a password.

> The webhook the CAPI fires from (`invoice.paid`) is **already registered** in
> Stripe, so no new Stripe webhook configuration is required for this.

---

## Step 3 — Set the environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for the
**Production** (and Preview, if you test there) environments. Names must match
exactly.

| Variable | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-123456789` (from Step 1) | public |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` | `AbC-dEfGhIjK` (from Step 1) | public |
| `NEXT_PUBLIC_META_PIXEL_ID` | your Pixel ID (from Step 2) | public |
| `META_CAPI_ACCESS_TOKEN` | your CAPI token (from Step 2) | **secret** |

Notes:
- The three `NEXT_PUBLIC_*` values are compiled into the browser bundle — that
  is by design (Pixel ID and Google conversion IDs are meant to be public).
- `META_CAPI_ACCESS_TOKEN` must **never** be prefixed `NEXT_PUBLIC_` — it is
  read only on the server.
- After setting them, **redeploy** so the `NEXT_PUBLIC_*` values are baked into
  the build (Vercel: Deployments → Redeploy, or push any commit).

---

## Step 4 — Run the database migration

The webhook stores Meta match-quality signals (`_fbp`/`_fbc` cookies, IP, user
agent) captured at checkout, so the server-side CAPI event has good match
quality. Apply the migration:

- File: `supabase/migrations/20260718120000_conversion_tracking.sql`
- It adds four nullable columns to `credit_purchases`: `fbp`, `fbc`,
  `client_ip`, `user_agent`. Purely additive; safe on existing data.

Apply it either way:
- **Supabase CLI:** `supabase db push`, **or**
- **Supabase dashboard:** SQL Editor → paste the file's contents → Run.

The feature works without this migration (CAPI still fires), but match quality
is lower, so run it.

---

## Step 5 — Verify

**Meta (best signal):**
1. Events Manager → your dataset → **Test Events** tab.
2. Complete a real subscription in the live app (use a real card; Stripe test
   cards won't hit the live pixel). A cheap monthly plan, then cancel, is fine.
3. You should see a **`Subscribe`** event arrive **twice as one deduplicated
   event** — labeled `Browser` and `Server`, merged. Seeing both sources merged
   is the success state.

**Google Ads:**
1. Google Ads → Goals → Conversions. A new conversion action shows
   **"Recording conversions"** only after the first real conversion (can take a
   few hours to move off "Inactive/No recent conversions").
2. For a faster check, use the **Google Tag Assistant** browser extension on
   `vibvid.ai/app` after a test subscription — it shows the `conversion` event
   firing with the right `send_to`.

**Quick sanity check (no purchase needed):** open `vibvid.ai`, open DevTools →
Network, and confirm requests to `googletagmanager.com/gtag/js` and
`connect.facebook.net/.../fbevents.js` load. If they don't, the
`NEXT_PUBLIC_*` vars aren't set or the app wasn't redeployed after setting them.

---

## Common mistakes to avoid

- **Forgetting to redeploy** after setting the `NEXT_PUBLIC_*` vars — they are
  build-time, so an old build won't have them.
- **Prefixing the CAPI token with `NEXT_PUBLIC_`** — that would leak the secret
  into the browser. It must be `META_CAPI_ACCESS_TOKEN` (server-only).
- **Testing with a Stripe test-mode purchase** and expecting the live Meta/Google
  events — those only fire on the live site with live keys.
- **Expecting two separate Meta conversions** — browser + server dedupe into
  one by design; that is correct, not a bug.
- **Pasting the full Google gtag snippet into the code** — not needed; the app
  renders gtag.js itself. Only the ID + label go into env vars.
