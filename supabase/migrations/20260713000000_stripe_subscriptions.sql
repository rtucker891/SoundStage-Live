-- Stripe subscriptions — one row per user, written only by the service role
-- (the Stripe webhook). getPlan() reads this to resolve a user's tier.
--
-- Apply via the Supabase connector / SQL editor. NOT applied automatically.

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free',
  status                 text,
  price_id               text,
  interval               text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

-- Look up a subscription by its Stripe customer (used by the webhook when the
-- subscription object carries no user_id metadata).
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- Row Level Security: a user may read ONLY their own row. No client may write —
-- all writes go through the webhook using the service role, which bypasses RLS.
alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);
