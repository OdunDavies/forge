-- Forge core schema. Public exercise catalog is unowned; everything else is per-user.

create table if not exists exercises (
  id text primary key,
  name text not null,
  force text,
  level text,
  mechanic text,
  equipment text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  category text,
  image_url text,
  source text not null default 'catalog',
  search_text text not null default ''
);
create index if not exists exercises_name_idx on exercises (lower(name));
create index if not exists exercises_category_idx on exercises (category);
create index if not exists exercises_equipment_idx on exercises (equipment);
create index if not exists exercises_search_text_idx on exercises (search_text);

create table if not exists profiles (
  user_id text primary key,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  sex text,
  birth_year integer,
  height_cm numeric,
  weight_kg numeric,
  units text not null default 'metric',
  experience text,
  goal text,
  days_per_week integer not null default 4,
  session_minutes integer not null default 60,
  equipment text[] not null default '{}',
  injuries text not null default '',
  available_days integer[] not null default '{1,2,3,4,5}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_handle_idx on profiles (handle);

create table if not exists workout_plans (
  id serial primary key,
  user_id text not null,
  title text not null,
  split text not null default '',
  days_per_week integer not null default 4,
  focus text not null default '',
  notes text not null default '',
  ai_rationale text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists workout_plans_user_idx on workout_plans (user_id, is_active);

create table if not exists plan_days (
  id serial primary key,
  plan_id integer not null references workout_plans(id) on delete cascade,
  user_id text not null,
  day_index integer not null,
  title text not null,
  is_rest boolean not null default false,
  coach_notes text not null default ''
);
create index if not exists plan_days_plan_idx on plan_days (plan_id, day_index);

create table if not exists plan_exercises (
  id serial primary key,
  plan_day_id integer not null references plan_days(id) on delete cascade,
  user_id text not null,
  exercise_id text,
  exercise_name text not null,
  sets integer not null default 3,
  reps text not null default '8',
  rest_sec integer not null default 90,
  target_rpe numeric,
  notes text not null default '',
  sort_order integer not null default 0
);
create index if not exists plan_exercises_day_idx on plan_exercises (plan_day_id, sort_order);

create table if not exists workout_sessions (
  id serial primary key,
  user_id text not null,
  plan_day_id integer,
  title text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_sec integer,
  bodyweight_kg numeric,
  energy integer,
  soreness integer,
  notes text not null default '',
  visibility text not null default 'public',
  volume_kg numeric not null default 0,
  set_count integer not null default 0,
  pr_count integer not null default 0
);
create index if not exists workout_sessions_user_idx on workout_sessions (user_id, started_at desc);
create index if not exists workout_sessions_feed_idx on workout_sessions (completed_at desc) where completed_at is not null and visibility = 'public';

create table if not exists session_sets (
  id serial primary key,
  session_id integer not null references workout_sessions(id) on delete cascade,
  user_id text not null,
  exercise_id text,
  exercise_name text not null,
  set_index integer not null,
  weight_kg numeric,
  reps integer,
  rpe numeric,
  completed boolean not null default true,
  is_warmup boolean not null default false,
  is_pr boolean not null default false
);
create index if not exists session_sets_session_idx on session_sets (session_id, exercise_name, set_index);

create table if not exists daily_logs (
  id serial primary key,
  user_id text not null,
  log_date date not null,
  sleep_hours numeric,
  bodyweight_kg numeric,
  energy integer,
  soreness integer,
  notes text not null default '',
  unique (user_id, log_date)
);
create index if not exists daily_logs_user_idx on daily_logs (user_id, log_date desc);

create table if not exists follows (
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
create index if not exists follows_following_idx on follows (following_id);

create table if not exists activity_kudos (
  activity_id integer not null references workout_sessions(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists activity_comments (
  id serial primary key,
  activity_id integer not null references workout_sessions(id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_comments_idx on activity_comments (activity_id, created_at);

create table if not exists coach_messages (
  id serial primary key,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_idx on coach_messages (user_id, created_at);

create table if not exists personal_records (
  id serial primary key,
  user_id text not null,
  exercise_id text,
  exercise_name text not null,
  weight_kg numeric not null,
  reps integer not null,
  estimated_1rm numeric,
  session_id integer,
  achieved_at timestamptz not null default now()
);
create index if not exists personal_records_user_idx on personal_records (user_id, exercise_name, achieved_at desc);
