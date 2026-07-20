-- Support tickets — raised from the landing page (email + message) or from
-- inside the app (signed-in user). Written ONLY through /api/support with the
-- service key; RLS stays closed to browser clients, so no policies here.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  topic text not null default 'other',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
