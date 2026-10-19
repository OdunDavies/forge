-- Server-owned checkout contracts and atomically consumed provider events.
create table billing_checkouts (
  id text primary key,
  user_id text not null references profiles(user_id),
  processor text not null check (processor in ('stripe', 'paystack')),
  interval text not null check (interval in ('month', 'year')),
  amount integer not null check (amount > 0),
  currency text not null,
  price_id text,
  provider_reference text unique,
  subscription_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);
create table billing_events (
  processor text not null,
  event_id text not null,
  checkout_id text not null references billing_checkouts(id),
  processed_at timestamptz not null default now(),
  primary key (processor, event_id)
);
alter table profiles add column plan_expires_at timestamptz;
alter table profiles add column billing_processor text;
alter table profiles add column stripe_subscription_id text;
create unique index profiles_stripe_subscription_idx on profiles(stripe_subscription_id);
-- Legacy unverified grants have no trustworthy paid-through date.
update profiles set plan = 'free' where plan <> 'free';
