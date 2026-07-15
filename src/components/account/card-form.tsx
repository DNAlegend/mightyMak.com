"use client";

// In-page card update. A SetupIntent is created server-side; the Payment
// Element collects the new card (Stripe's own secure iframe), confirms the
// setup without leaving the page, then we make it the default for renewals.

import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { getStripe } from "@/lib/stripe-client";
import { Button } from "@/components/ui";

function Inner({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });
      if (confirmErr) {
        setError(confirmErr.message ?? "Could not save the card.");
        return;
      }
      const pm = setupIntent?.payment_method;
      const pmId = typeof pm === "string" ? pm : pm?.id;
      if (!pmId) {
        setError("Could not read the new card.");
        return;
      }
      const token = (await import("@/lib/supabase")).supabase
        ? (await (await import("@/lib/supabase")).supabase!.auth.getSession()).data.session?.access_token
        : undefined;
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "card-default", paymentMethodId: pmId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not set the new card as default.");
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PaymentElement />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={busy || !stripe}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Save card"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function CardForm({
  clientSecret,
  onSaved,
  onCancel,
}: {
  clientSecret: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <Inner onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
}
