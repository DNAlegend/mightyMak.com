"use client";

// Owner dashboard: every user, their balance, and platform activity at a
// glance. Sign in with the normal OTP flow; the server only answers if the
// signed-in email is on the admin allowlist (ADMIN_EMAILS), so this page is
// safe even though the route is guessable.

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Coins,
  DollarSign,
  Film,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { LogoWordmark } from "@/components/logo";

interface Stats {
  totals: {
    users: number;
    usersNew7d: number;
    activeUsers7d: number;
    generations: number;
    generations24h: number;
    failed: number;
    rendering: number;
    creditsOutstanding: number;
    creditsSpentAllTime: number;
    paidPurchases: number;
  };
  days: { day: string; count: number }[];
  users: {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    credits: number | null;
    generations: number;
    failed: number;
    creditsSpent: number;
    assets: number;
    plans: number;
    lastActive: string | null;
  }[];
  recent: { email: string; modality: string; status: string; cost: number; at: string; prompt: string }[];
  purchases: {
    email: string;
    kind: string;
    item: string;
    credits: number;
    amount: number;
    currency: string;
    status: string;
    at: string;
  }[];
  revenue: {
    mrr: number;
    arr: number;
    activeSubscribers: number;
    pastDue: number;
    scheduledCancels: number;
    canceled30d: number;
    churnRate: number;
    truncated: boolean;
    subscribers: {
      email: string;
      label: string;
      interval: "month" | "year" | null;
      mrr: number;
      status: string;
      cancelAtPeriodEnd: boolean;
      renews: string | null;
      startedAt: string | null;
      generations: number;
      lastActive: string | null;
    }[];
  } | null;
}

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

export function AdminDashboard() {
  const [phase, setPhase] = useState<"checking" | "signedout" | "forbidden" | "loading" | "ready" | "error">(
    "checking",
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) {
      setPhase("error");
      setErrMsg("Supabase isn’t configured in this environment.");
      return;
    }
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setPhase("signedout");
      return;
    }
    setPhase("loading");
    try {
      const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return setPhase("signedout");
      if (res.status === 403) return setPhase("forbidden");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
      setPhase("ready");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Failed to load");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  if (phase === "checking" || phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={22} className="animate-spin text-accent" />
      </div>
    );
  }

  if (phase === "signedout") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <LogoWordmark className="text-2xl" />
        <p className="text-sm text-muted">Owner dashboard — sign in to continue.</p>
        <Button onClick={() => setAuthOpen(true)}>Sign in</Button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  if (phase === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
          <ShieldAlert size={22} />
        </span>
        <h1 className="text-xl font-bold">This area is restricted</h1>
        <p className="max-w-sm text-sm text-muted">
          Your account doesn’t have access to the owner dashboard.
        </p>
        <Button variant="outline" size="sm" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  if (phase === "error" || !stats) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-danger">Couldn’t load the dashboard: {errMsg}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  const { totals, days, users, recent, purchases, revenue } = stats;
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoWordmark />
          <Badge tone="accent">Admin</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </header>

      {/* Revenue */}
      {revenue && (
        <>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
            <DollarSign size={13} className="text-teal" /> Revenue
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="MRR" value={usd(revenue.mrr)} sub="monthly recurring" />
            <StatTile label="ARR" value={usd(revenue.arr)} sub="annual run-rate" />
            <StatTile
              label="Active subscribers"
              value={revenue.activeSubscribers}
              sub={revenue.pastDue > 0 ? `${revenue.pastDue} past due` : undefined}
            />
            <StatTile
              label="Churn (30d)"
              value={`${(revenue.churnRate * 100).toFixed(1)}%`}
              sub={`${revenue.canceled30d} canceled`}
            />
            <StatTile
              label="Scheduled cancels"
              value={revenue.scheduledCancels}
              sub={revenue.scheduledCancels > 0 ? "cancel at period end" : "none pending"}
            />
          </div>
        </>
      )}

      {/* Topline */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Users" value={totals.users} sub={`+${totals.usersNew7d} this week`} />
        <StatTile label="Active (7d)" value={totals.activeUsers7d} />
        <StatTile label="Generations" value={totals.generations} sub={`${totals.generations24h} in 24h`} />
        <StatTile
          label="Credits held"
          value={totals.creditsOutstanding.toLocaleString()}
          sub={`${totals.creditsSpentAllTime.toLocaleString()} spent all-time`}
        />
        <StatTile
          label="Health"
          value={totals.rendering > 0 ? `${totals.rendering} rendering` : "idle"}
          sub={`${totals.failed} failed all-time`}
        />
      </div>

      {/* 14-day activity */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
          <Activity size={13} className="text-accent-2" /> Generations — last 14 days
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {days.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div
                className={cn("w-full rounded-t", d.count > 0 ? "bg-accent" : "bg-line")}
                style={{ height: `${Math.max(4, (d.count / maxDay) * 88)}px` }}
              />
              <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[10px] font-semibold text-surface group-hover:block">
                {d.day.slice(5)} · {d.count}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Subscribers — paying customers + their activity */}
      {revenue && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
              <TrendingUp size={13} className="text-teal" /> Subscribers ({revenue.subscribers.length})
            </div>
            {revenue.truncated && <span className="text-[11px] text-faint">showing first 100</span>}
          </div>
          {revenue.subscribers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No active subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Plan</th>
                    <th className="px-3 py-2 text-right font-semibold">MRR</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Gens</th>
                    <th className="px-3 py-2 font-semibold">Last active</th>
                    <th className="px-3 py-2 font-semibold">Renews</th>
                    <th className="px-4 py-2 font-semibold">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.subscribers.map((s, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                      <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-fg">{s.email}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                        {s.label}
                        <span className="text-faint"> · {s.interval === "year" ? "annual" : "monthly"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{usd(s.mrr)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={s.cancelAtPeriodEnd ? "neutral" : s.status === "active" ? "teal" : "accent"}>
                          {s.cancelAtPeriodEnd ? "canceling" : s.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{s.generations}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted">{ago(s.lastActive)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                        {s.renews ? new Date(s.renews).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                        {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Users */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
          <Users size={13} className="text-accent-2" /> Users ({users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 text-right font-semibold">Credits</th>
                <th className="px-3 py-2 text-right font-semibold">Gens</th>
                <th className="px-3 py-2 text-right font-semibold">Spent</th>
                <th className="px-3 py-2 text-right font-semibold">Assets</th>
                <th className="px-3 py-2 text-right font-semibold">Plans</th>
                <th className="px-3 py-2 font-semibold">Last active</th>
                <th className="px-4 py-2 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-fg">{u.email}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Coins size={12} className="text-warn" />
                      {u.credits ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {u.generations}
                    {u.failed > 0 && <span className="ml-1 text-[11px] text-danger">({u.failed}✗)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{u.creditsSpent}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{u.assets}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{u.plans}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted">{ago(u.lastActive)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent activity */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
          <Film size={13} className="text-accent-2" /> Recent generations
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No generations yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <Badge
                  tone={r.status === "succeeded" ? "teal" : r.status === "failed" ? "accent" : "neutral"}
                >
                  {r.status}
                </Badge>
                <span className="font-medium text-fg">{r.email}</span>
                <span className="text-muted">{r.modality}</span>
                <span className="tabular-nums text-muted">{r.cost}cr</span>
                <span className="text-faint">{ago(r.at)}</span>
                <span className="w-full truncate text-[12px] text-faint sm:w-auto sm:max-w-[300px] sm:flex-1">
                  {r.prompt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Purchases */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
          <Coins size={13} className="text-accent-2" /> Purchases ({totals.paidPurchases} paid)
        </div>
        {purchases.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Credits</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">{p.email}</td>
                    <td className="px-3 py-2.5 text-muted">{p.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.credits}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {p.currency} {p.amount}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={p.status === "paid" ? "teal" : p.status === "failed" ? "accent" : "neutral"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{ago(p.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-6 text-center text-[12px] text-faint">
        Access is limited to allowlisted owner accounts, checked server-side on every request.
      </p>
    </div>
  );
}
