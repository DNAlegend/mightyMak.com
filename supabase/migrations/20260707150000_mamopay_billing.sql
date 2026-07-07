-- MamoPay billing: a purchase ledger + per-charge, idempotent credit grants.
-- A checkout creates one `credit_purchases` row (the intent). Each successful
-- MamoPay charge (one-off, or a monthly subscription renewal) is recorded once
-- in `credit_charges` and grants that purchase's credits exactly once.

create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('topup', 'subscription')),
  item text not null,
  credits integer not null check (credits > 0),
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  mamo_link_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.credit_purchases enable row level security;
-- Read-only to the owner; all writes happen through the service role (routes).
create policy "purchases_select_own" on public.credit_purchases
  for select using ((select auth.uid()) = user_id);

create table public.credit_charges (
  charge_id text primary key,
  purchase_id uuid references public.credit_purchases (id) on delete set null,
  user_id uuid not null,
  credits integer not null,
  created_at timestamptz not null default now()
);

alter table public.credit_charges enable row level security;
-- No client access at all; the webhook (service role) is the only writer/reader.

-- Grant a charge's credits exactly once. Idempotent on charge_id: a replayed
-- webhook is a no-op. Called ONLY by the webhook via the service role.
create function public.settle_charge(
  p_charge_id text,
  p_purchase_id uuid,
  p_user uuid,
  p_credits integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_charges (charge_id, purchase_id, user_id, credits)
  values (p_charge_id, p_purchase_id, p_user, p_credits)
  on conflict (charge_id) do nothing;

  if not found then
    return false; -- already credited for this charge
  end if;

  update public.profiles set credits = credits + p_credits, updated_at = now()
   where id = p_user;

  if p_purchase_id is not null then
    update public.credit_purchases
       set status = 'paid', paid_at = now()
     where id = p_purchase_id and status <> 'paid';
  end if;

  return true;
end;
$$;

-- Critical: keep this function OFF-limits to logged-in users — otherwise they
-- could grant themselves credits. Only the service-role webhook may call it.
revoke execute on function public.settle_charge(text, uuid, uuid, integer)
  from public, anon, authenticated;
