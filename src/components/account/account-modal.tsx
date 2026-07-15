"use client";

// On-site account & billing. Shows the current plan, credit balance, card on
// file, and invoice history, and lets the customer cancel, resume, switch plan,
// and update their card — all without leaving vibvid.ai or touching a
// Stripe-hosted page.

import { useCallback, useEffect, useState } from "react";
import { Loader2, CreditCard, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PLAN_ITEMS, planVariant } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Modal, Button, Badge } from "@/components/ui";
import { CardForm } from "@/components/account/card-form";

interface Overview {
  credits: number;
  billing: {
    plan: { itemId: string; label: string; interval: "month" | "year"; priceLabel: string; credits: number } | null;
    status: string | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
    invoices: { id: string; date: number; amount: number; currency: string; status: string; url: string | null }[];
  } | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtDate(secs: number) {
  return new Date(secs * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtMoney(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString(undefined, { style: "currency", currency: currency.toUpperCase() })}`;
}

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [cardSecret, setCardSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { headers: await authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load your account.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSwitching(false);
      setCardSecret(null);
      void load();
    }
  }, [open, load]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setActing(action);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "That didn’t work.");
      if (d.clientSecret) {
        setCardSecret(d.clientSecret);
        return;
      }
      await load();
      setSwitching(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work.");
    } finally {
      setActing(null);
    }
  }

  const billing = data?.billing;
  const plan = billing?.plan;
  const canceling = billing?.cancelAtPeriodEnd;

  return (
    <Modal open={open} onClose={onClose} title="Account & billing" size="lg">
      {loading && !data ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-faint" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Credits */}
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-2 p-4">
            <div>
              <div className="text-[13px] text-faint">Credit balance</div>
              <div className="text-2xl font-bold tabular-nums">{(data?.credits ?? 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Plan */}
          {plan ? (
            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-fg">{plan.label}</span>
                    <Badge tone={canceling ? "neutral" : "accent"}>
                      {canceling ? "Cancels at period end" : billing?.status === "active" ? "Active" : billing?.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[13px] text-faint">
                    {plan.priceLabel}/{plan.interval === "year" ? "yr" : "mo"} · {plan.credits.toLocaleString()} credits per{" "}
                    {plan.interval === "year" ? "year" : "month"}
                  </div>
                  {billing?.currentPeriodEnd && (
                    <div className="mt-0.5 text-[12px] text-faint">
                      {canceling ? "Access until" : "Renews"} {fmtDate(billing.currentPeriodEnd)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSwitching((s) => !s)} disabled={!!acting}>
                  Switch plan
                </Button>
                {canceling ? (
                  <Button size="sm" variant="outline" onClick={() => act("resume")} disabled={!!acting}>
                    {acting === "resume" ? <Loader2 size={14} className="animate-spin" /> : "Resume plan"}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => act("cancel")} disabled={!!acting}>
                    {acting === "cancel" ? <Loader2 size={14} className="animate-spin" /> : "Cancel plan"}
                  </Button>
                )}
              </div>

              {/* Switch-plan picker */}
              {switching && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-faint">Choose a plan</div>
                  {PLAN_ITEMS.flatMap((base) => [base, planVariant(base.id, "year")!]).map((p) => {
                    const current = p.id === plan.itemId;
                    return (
                      <button
                        key={p.id}
                        disabled={current || !!acting}
                        onClick={() => act("switch", { itemId: p.id })}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                          current ? "border-accent/40 bg-accent-soft/40" : "border-line hover:border-faint",
                          acting ? "opacity-60" : "",
                        )}
                      >
                        <span className="text-[13px]">
                          <span className="font-semibold text-fg">{p.label}</span>{" "}
                          <span className="text-faint">
                            · {p.credits.toLocaleString()} cr / {p.interval === "year" ? "yr" : "mo"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-2">
                          {p.priceLabel}/{p.interval === "year" ? "yr" : "mo"}
                          {current && <Check size={14} className="text-teal" />}
                          {acting === "switch" && <Loader2 size={13} className="animate-spin" />}
                        </span>
                      </button>
                    );
                  })}
                  <p className="text-[12px] text-faint">
                    Your plan changes at your next renewal — the new price and credits start then. You
                    keep your current credits until then.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-line p-4 text-[13px] text-faint">
              No active subscription. Buy a plan or a top-up from the credits menu.
            </div>
          )}

          {/* Card on file */}
          {billing && (
            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CreditCard size={18} className="text-faint" />
                  {billing.card ? (
                    <span className="text-[13px] text-fg">
                      <span className="capitalize">{billing.card.brand}</span> ···· {billing.card.last4}
                      <span className="ml-2 text-faint">
                        exp {String(billing.card.expMonth).padStart(2, "0")}/{String(billing.card.expYear).slice(-2)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint">No card on file</span>
                  )}
                </div>
                {!cardSecret && (
                  <Button size="sm" variant="outline" onClick={() => act("card-setup")} disabled={!!acting}>
                    {acting === "card-setup" ? <Loader2 size={14} className="animate-spin" /> : billing.card ? "Update card" : "Add card"}
                  </Button>
                )}
              </div>
              {cardSecret && (
                <div className="mt-4 border-t border-line pt-4">
                  <CardForm
                    clientSecret={cardSecret}
                    onSaved={() => {
                      setCardSecret(null);
                      void load();
                    }}
                    onCancel={() => setCardSecret(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Invoices */}
          {billing && billing.invoices.length > 0 && (
            <div className="rounded-2xl border border-line p-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Billing history</div>
              <div className="divide-y divide-line">
                {billing.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="text-muted">{fmtDate(inv.date)}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums text-fg">{fmtMoney(inv.amount, inv.currency)}</span>
                      <Badge tone={inv.status === "paid" ? "accent" : "neutral"}>{inv.status}</Badge>
                      {inv.url && (
                        <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:text-accent">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
