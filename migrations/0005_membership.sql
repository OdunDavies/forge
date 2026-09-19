-- Three memberships: free, pro, pro_max. Waitlist records which paid tier.
alter table pro_intents add column if not exists plan text not null default 'pro';
