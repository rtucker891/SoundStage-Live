-- Guarantee every new user gets a free `subscriptions` row.
--
-- Why: free rows can't be created from the client (RLS forbids client writes on
-- public.subscriptions — all writes go through the Stripe webhook / service
-- role), and the webhook only writes a row when a user checks out. So any signup
-- that never paid ended up with NO subscriptions row at all (e.g.
-- yangastudioart@gmail.com), leaving their plan null instead of 'free'.
--
-- Fix: a SECURITY DEFINER trigger on auth.users AFTER INSERT inserts a free row.
-- This can't be bypassed and works regardless of which signup path is used.
-- The insert is idempotent (ON CONFLICT DO NOTHING) so re-signup / replays are
-- safe and it never clobbers an existing paid row.
--
-- Apply via the Supabase apply_migration tool. NOT applied automatically.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- One-time backfill: give every EXISTING user without a row a free plan.
-- Covers yangastudioart@gmail.com and any other pre-existing account that is
-- missing a subscriptions row. Never touches users who already have a row.
insert into public.subscriptions (user_id, plan, status)
select u.id, 'free', 'active'
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null
on conflict (user_id) do nothing;
