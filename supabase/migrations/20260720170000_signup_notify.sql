-- Every new account pings /api/notify-signup (which emails the founder).
-- pg_net's http_post is async — it enqueues and returns, so signup latency
-- is untouched; and the whole call is wrapped so a notification hiccup can
-- NEVER block an account from being created.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://vibvid.ai/api/notify-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-signup-secret', '59bc2afff7b56cd9b62b46b1870dae2e4e2f19e8e109e343'
      ),
      body := jsonb_build_object(
        'email', new.email,
        'created_at', new.created_at
      )
    );
  exception when others then
    null; -- notification is best-effort; account creation always wins
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify
  after insert on auth.users
  for each row execute function public.notify_signup();
