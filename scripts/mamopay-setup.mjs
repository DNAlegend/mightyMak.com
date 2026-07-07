// Register (or list) the MamoPay webhook so payments credit accounts.
//
//   MAMOPAY_API_KEY=... MAMOPAY_WEBHOOK_SECRET=... SITE_URL=https://mightymak.vercel.app \
//     node scripts/mamopay-setup.mjs
//
// Reads the same vars from .env.local if present. Set MAMOPAY_ENV=production to
// target live; otherwise it uses the sandbox. Run once after adding your key.

import { readFile } from "node:fs/promises";

try {
  const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.+?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const KEY = process.env.MAMOPAY_API_KEY;
const SECRET = process.env.MAMOPAY_WEBHOOK_SECRET;
const SITE = process.env.SITE_URL ?? "https://mightymak.vercel.app";
const BASE =
  process.env.MAMOPAY_ENV === "production"
    ? "https://business.mamopay.com/manage_api/v1"
    : "https://sandbox.dev.business.mamopay.com/manage_api/v1";

if (!KEY) {
  console.error("Missing MAMOPAY_API_KEY.");
  process.exit(1);
}
if (!SECRET) {
  console.error("Missing MAMOPAY_WEBHOOK_SECRET (any long random string you also set in Vercel).");
  process.exit(1);
}

const headers = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const webhookUrl = `${SITE}/api/mamopay/webhook?key=${encodeURIComponent(SECRET)}`;

console.log(`Env: ${process.env.MAMOPAY_ENV === "production" ? "PRODUCTION" : "sandbox"}`);
console.log(`Webhook URL: ${webhookUrl}\n`);

// Show what's already registered.
const existing = await fetch(`${BASE}/webhooks`, { headers }).then((r) => r.json()).catch(() => null);
console.log("Existing webhooks:", JSON.stringify(existing)?.slice(0, 400) || "(none / not readable)");

const res = await fetch(`${BASE}/webhooks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: webhookUrl,
    enabled_events: [
      "charge.succeeded",
      "charge.failed",
      "subscription.succeeded",
      "subscription.failed",
    ],
    auth_header: SECRET,
  }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`\nFailed to register webhook (${res.status}): ${body.slice(0, 400)}`);
  process.exit(1);
}
console.log(`\n✓ Webhook registered: ${body.slice(0, 400)}`);
