-- Phase 2: Progression scoring and snapshots
-- Adds baseline_lifts jsonb to profiles and score_snapshots table for weekly scoring

alter table profiles add column if not exists baseline_lifts jsonb not null default '{}';

create table if not exists score_snapshots (
  user_id text not null,
  week_start date not null,
  score int not null default 0,
  pillars jsonb not null default '{"consistency": 0, "strength": 0, "progression": 0, "focus": 0}'::jsonb,
  narrative text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index if not exists score_snapshots_user_idx on score_snapshots (user_id, week_start desc);
create index if not exists score_snapshots_week_idx on score_snapshots (week_start desc);