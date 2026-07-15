// Admin dashboard data — users, credits, and activity across the platform.
//
// Security model: the caller signs in like any user (OTP) and sends their
// access token; we verify the JWT server-side, then check the account's email
// against the admin allowlist before touching anything with the service-role
// client. Non-admins get a 403 no matter what they know about the route.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripeConfigured, getRevenueMetrics } from "@/lib/stripe";

export const maxDuration = 30;

/** Comma-separated allowlist; defaults to the owner. Override via env. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "abuaisha.hussin@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const DAY = 86_400_000;

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  // 1. Who is calling?
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: caller, error: authErr } = await supabaseAdmin.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (authErr || !callerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Are they on the allowlist?
  if (!adminEmails().includes(callerEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Gather. Early-stage scale: pull capped raw rows and aggregate here.
  const [usersRes, profilesRes, gensRes, assetsRes, plansRes, purchasesRes, custRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    supabaseAdmin.from("profiles").select("id, credits").limit(1000),
    supabaseAdmin
      .from("generations")
      .select("user_id, status, modality, credits_cost, created_at, prompt")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin.from("assets").select("user_id").limit(5000),
    supabaseAdmin.from("plans").select("user_id, title, created_at").limit(1000),
    supabaseAdmin
      .from("credit_purchases")
      .select("user_id, kind, item, credits, amount, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("billing_customers").select("user_id, stripe_customer_id").limit(1000),
  ]);

  const users = usersRes.data?.users ?? [];
  const credits = new Map((profilesRes.data ?? []).map((p) => [p.id, p.credits as number]));
  const gens = gensRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const purchases = purchasesRes.data ?? [];
  const userOfCustomer = new Map((custRes.data ?? []).map((r) => [r.stripe_customer_id, r.user_id]));

  const emailOf = new Map(users.map((u) => [u.id, u.email ?? "(no email)"]));
  const now = Date.now();

  // Timestamps are mixed across tables (generations/assets/plans store bigint
  // ms epoch mirroring the client; auth users and purchases are timestamptz
  // ISO strings) — normalize everything to epoch ms, emit ISO to the client.
  const ts = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v) return Date.parse(v) || 0;
    return 0;
  };
  const iso = (v: unknown): string | null => (ts(v) ? new Date(ts(v)).toISOString() : null);

  // Per-user aggregates.
  const byUser = new Map<string, { gens: number; failed: number; spent: number; lastActive: number }>();
  for (const g of gens) {
    const b = byUser.get(g.user_id) ?? { gens: 0, failed: 0, spent: 0, lastActive: 0 };
    b.gens += 1;
    if (g.status === "failed") b.failed += 1;
    b.spent += g.credits_cost ?? 0;
    b.lastActive = Math.max(b.lastActive, ts(g.created_at));
    byUser.set(g.user_id, b);
  }
  const assetCount = new Map<string, number>();
  for (const a of assets) assetCount.set(a.user_id, (assetCount.get(a.user_id) ?? 0) + 1);
  const planCount = new Map<string, number>();
  for (const p of plans) planCount.set(p.user_id, (planCount.get(p.user_id) ?? 0) + 1);

  const userRows = users
    .map((u) => {
      const agg = byUser.get(u.id);
      const lastActive = Math.max(agg?.lastActive ?? 0, ts(u.last_sign_in_at));
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        createdAt: iso(u.created_at),
        lastSignInAt: iso(u.last_sign_in_at),
        credits: credits.get(u.id) ?? null,
        generations: agg?.gens ?? 0,
        failed: agg?.failed ?? 0,
        creditsSpent: agg?.spent ?? 0,
        assets: assetCount.get(u.id) ?? 0,
        plans: planCount.get(u.id) ?? 0,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        _sort: lastActive || ts(u.created_at),
      };
    })
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort, ...row }) => row);

  // Topline stats.
  const within = (v: unknown, ms: number) => ts(v) > 0 && now - ts(v) < ms;
  const totals = {
    users: users.length,
    usersNew7d: users.filter((u) => within(u.created_at, 7 * DAY)).length,
    activeUsers7d: userRows.filter((u) => within(u.lastActive, 7 * DAY)).length,
    generations: gens.length,
    generations24h: gens.filter((g) => within(g.created_at, DAY)).length,
    failed: gens.filter((g) => g.status === "failed").length,
    rendering: gens.filter((g) => g.status === "rendering").length,
    creditsOutstanding: [...credits.values()].reduce((s, c) => s + (c ?? 0), 0),
    creditsSpentAllTime: gens.reduce((s, g) => s + (g.credits_cost ?? 0), 0),
    paidPurchases: purchases.filter((p) => p.status === "paid").length,
  };

  // 14-day activity histogram (generations per day, oldest → newest).
  const days: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    days.push({
      day: key,
      count: gens.filter((g) => (iso(g.created_at) ?? "").startsWith(key)).length,
    });
  }

  // Recent activity feed.
  const recent = gens.slice(0, 30).map((g) => ({
    email: emailOf.get(g.user_id) ?? g.user_id,
    modality: g.modality,
    status: g.status,
    cost: g.credits_cost ?? 0,
    at: iso(g.created_at),
    prompt: typeof g.prompt === "string" ? g.prompt.slice(0, 90) : "",
  }));

  const recentPurchases = purchases.slice(0, 20).map((p) => ({
    email: emailOf.get(p.user_id) ?? p.user_id,
    kind: p.kind,
    item: p.item,
    credits: p.credits,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    at: iso(p.created_at),
  }));

  // Revenue metrics + paying-customer activity, live from Stripe (best-effort:
  // the rest of the dashboard still renders if Stripe is down or unconfigured).
  let revenue: unknown = null;
  if (stripeConfigured()) {
    try {
      const m = await getRevenueMetrics();
      const subscribers = m.subscribers.map((sub) => {
        const uid = userOfCustomer.get(sub.customerId) ?? null;
        const agg = uid ? byUser.get(uid) : undefined;
        return {
          email: uid ? emailOf.get(uid) ?? "(unknown)" : "(unlinked customer)",
          label: sub.label,
          interval: sub.interval,
          mrr: sub.mrrCents / 100,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          renews: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd * 1000).toISOString() : null,
          startedAt: sub.startedAt ? new Date(sub.startedAt * 1000).toISOString() : null,
          generations: agg?.gens ?? 0,
          lastActive: agg?.lastActive ? new Date(agg.lastActive).toISOString() : null,
        };
      });
      revenue = {
        mrr: m.mrrCents / 100,
        arr: m.arrCents / 100,
        activeSubscribers: m.activeSubscribers,
        pastDue: m.pastDue,
        scheduledCancels: m.scheduledCancels,
        canceled30d: m.canceled30d,
        churnRate: m.churnRate,
        truncated: m.truncated,
        subscribers,
      };
    } catch (e) {
      console.error("[admin/stats] revenue metrics failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ totals, days, users: userRows, recent, purchases: recentPurchases, revenue });
}
