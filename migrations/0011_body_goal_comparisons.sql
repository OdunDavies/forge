alter table goal_scans add column if not exists scan_kind text not null default 'reference';
alter table goal_scans add column if not exists training_goal text;
