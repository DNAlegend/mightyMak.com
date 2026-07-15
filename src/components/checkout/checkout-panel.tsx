"use client";

// Stripe Embedded Checkout — the payment form renders in-page on vibvid.ai
// (no redirect to a Stripe-hosted page). The card fields inside are Stripe's
// own secure iframe, so we never touch raw card data. On completion Stripe
// returns the buyer to /app?purchase=success and the app polls credits in.

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { ArrowLeft } from "lucide-react";
import { getStripe } from "@/lib/stripe-client";

export function CheckoutPanel({
  clientSecret,
  onBack,
}: {
  clientSecret: string;
  /** Optional "back" affordance shown above the form. */
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} /> Back
        </button>
      )}
      <div className="overflow-hidden rounded-2xl">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
