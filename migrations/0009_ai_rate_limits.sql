create table if not exists ai_rate_limits (
  user_id text primary key,
  window_start timestamptz not null,
  requests integer not null default 1 check (requests > 0)
);
