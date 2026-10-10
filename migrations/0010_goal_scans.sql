create table if not exists goal_scans (
  id bigserial primary key,
  user_id text not null,
  summary text not null,
  focus_muscles text[] not null default '{}',
  training_notes text[] not null default '{}',
  limitations text not null,
  created_at timestamptz not null default now()
);
create index if not exists goal_scans_user_created on goal_scans (user_id, created_at desc);
