-- Billing checkout + photo storage
alter table profiles add column if not exists billing_interval text;
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists plan_updated_at timestamptz;

alter table pro_intents add column if not exists status text not null default 'pending';
alter table pro_intents add column if not exists checkout_url text;

-- photo_url already text; keep as url-or-dataUrl, add size guard is in app code
