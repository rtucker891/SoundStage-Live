-- Stripe billing foundation. Apply only after reviewing in Supabase.
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null default 'free' check (plan in ('free', 'creator', 'studio')),
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_user_id_key
  on public.billing_subscriptions(user_id) where user_id is not null;
create unique index if not exists billing_subscriptions_customer_id_key
  on public.billing_subscriptions(stripe_customer_id);

alter table public.billing_subscriptions enable row level security;
drop policy if exists "Users can read their billing subscription" on public.billing_subscriptions;
create policy "Users can read their billing subscription"
  on public.billing_subscriptions for select
  using (auth.uid() = user_id);

-- Webhook idempotency ledger. No client policies: service-role access only.
create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_webhook_events enable row level security;

comment on table public.billing_subscriptions is
  'Server-maintained Stripe subscription projection. Clients may only read their own row.';
comment on table public.billing_webhook_events is
  'Processed Stripe event IDs used to make webhook handling idempotent.';
