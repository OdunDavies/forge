-- Membership: free vs pro, plus waitlist for Paystack / Stripe checkout.
alter table profiles add column if not exists plan text not null default 'free';
alter table profiles add column if not exists billing_region text not null default 'intl';

create table if not exists pro_intents (
  id serial primary key,
  user_id text,
  email text not null,
  region text not null,
  interval text not null,
  created_at timestamptz not null default now()
);
create index if not exists pro_intents_email_idx on pro_intents (email);
