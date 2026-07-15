-- ============================================================
-- VIBVID — paste this WHOLE file into the Supabase SQL editor
-- and click RUN once. Safe to re-run if partially applied.
-- Combines the pending migrations (2026-07-14 → 2026-07-16).
-- ============================================================

-- ---- 20260714200000_launch_hardening ----
-- Launch hardening: per-user rate limits for the LLM routes, ToS acceptance
-- timestamp, and an atomic settle for failed renders (flip + refund in one
-- transaction, closing the serverless-kill refund-loss window).

-- 1. Fixed-hourly-window rate limiter -------------------------------------------
-- One row per (user, bucket, hour window). SECURITY DEFINER, but hard-scoped to
-- auth.uid() — callers can only ever consume their own quota.
create table if not exists public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- No policies: only the RPC below (and service role) touches it.

create or replace function public.consume_rate_limit(p_bucket text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (v_user, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Opportunistic cleanup of old windows for this user+bucket.
  delete from public.rate_limits
  where user_id = v_user and bucket = p_bucket and window_start < v_window - interval '2 hours';
  return v_count <= p_max;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer) to authenticated;

-- 2. Terms-of-service acceptance --------------------------------------------
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

-- Owners may stamp their own acceptance (once; later writes just overwrite
-- with a fresh timestamp, which is fine — latest acceptance wins).
-- profiles UPDATE policy already exists for own row; no new policy needed.

-- 3. Atomic failed-render settle --------------------------------------------
-- Flips a generation rendering→failed AND refunds its cost in one transaction.
-- Returns true only when this call performed the flip (and hence the refund),
-- so concurrent pollers can never double-refund and a crash can't lose one.
create or replace function public.settle_render_failure(p_id text, p_error text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost integer;
begin
  if v_user is null then
    return false;
  end if;
  update public.generations
     set status = 'failed', progress = 100, error = left(coalesce(p_error, 'failed'), 300)
   where id = p_id and user_id = v_user and status = 'rendering'
  returning credits_cost into v_cost;
  if not found then
    return false; -- someone else settled it (or it isn't rendering)
  end if;
  update public.profiles
     set credits = credits + coalesce(v_cost, 0)
   where id = v_user;
  return true;
end;
$$;
revoke all on function public.settle_render_failure(text, text) from public, anon;
grant execute on function public.settle_render_failure(text, text) to authenticated;

-- ---- 20260715120000_stripe_paid_only ----
-- Stripe era, paid only: no free tier, no trial. New accounts start with zero
-- credits — the Stripe webhook deposits the plan's credits after the first
-- successful payment. Supersedes the 20-credit free-tier default.
alter table public.profiles alter column credits set default 0;

-- ---- 20260715130000_lock_credit_writes ----
-- Lock down credit writes. With no free tier, credits are the paywall — so no
-- client-reachable path may ever ADD credits. Before this migration a signed-in
-- user could mint credits two ways:
--   1. adjust_credits(delta) accepted any positive delta, and
--   2. the profiles UPDATE policy wasn't column-restricted, so
--      update profiles set credits = … went straight through PostgREST.
-- Grants now flow only through SECURITY DEFINER server paths: settle_charge
-- (Stripe webhook), settle_render_failure (atomic failed-render refund), and
-- grant_credits below (service-role refunds in /api/generate).

-- 1. adjust_credits: spends (and a delta-0 balance read) only ----------------
-- Same signature and return contract (new balance, or null when the spend
-- would go negative — and now also null for any positive delta).
create or replace function public.adjust_credits(delta integer) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.uid() is null or delta > 0 then
    return null; -- grants are server-side only
  end if;
  update public.profiles
     set credits = credits + delta, updated_at = now()
   where id = auth.uid() and credits + delta >= 0
  returning credits into v_balance;
  return v_balance;
end;
$$;
revoke all on function public.adjust_credits(integer) from public, anon;
grant execute on function public.adjust_credits(integer) to authenticated;

-- 2. Service-role refunds ----------------------------------------------------
-- /api/generate refunds a failed render's cost through the admin client.
create or replace function public.grant_credits(p_user uuid, p_delta integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set credits = credits + p_delta, updated_at = now()
   where id = p_user and p_delta > 0;
$$;
revoke all on function public.grant_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer) to service_role;

-- 3. Clients may update nothing on profiles except their ToS acceptance ------
revoke update on table public.profiles from anon, authenticated;
grant update (accepted_terms_at) on public.profiles to authenticated;

-- ---- 20260716120000_billing_customers ----
-- One Stripe customer per user, so the on-site account page can list invoices,
-- switch plans, cancel, and update the card. Written only by the service role
-- (checkout route + webhook); the account API reads it with the service role
-- too, so no client policies are needed.
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique not null,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
-- No policies: only the service role touches this table.

