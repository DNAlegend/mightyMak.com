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
