"use client";

// Browser-side Stripe.js loader. Uses the publishable key (safe to expose).
// When the key is unset, getStripe() resolves to null and callers fall back to
// the demo path — the app still works without payments configured.

import { loadStripe, type Stripe } from "@stripe/stripe-js";

const KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const stripePublicConfigured = Boolean(KEY);

let promise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!KEY) return Promise.resolve(null);
  if (!promise) promise = loadStripe(KEY);
  return promise;
}
