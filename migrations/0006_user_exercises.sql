-- Personal lifts typed in during a session, reused on later logs.
create table if not exists user_exercises (
  id serial primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_exercises_user_name_idx
  on user_exercises (user_id, lower(name));
create index if not exists user_exercises_user_idx
  on user_exercises (user_id, created_at desc);
