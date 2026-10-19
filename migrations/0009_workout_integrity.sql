-- Records are derived from their actual working set, never append-only claims.
alter table session_sets add column if not exists logged_at timestamptz;
update session_sets s set logged_at = w.started_at
from workout_sessions w where w.id = s.session_id and s.completed and s.logged_at is null;
alter table personal_records add column if not exists source_set_id integer references session_sets(id) on delete cascade;
create unique index if not exists personal_records_source_idx on personal_records(source_set_id);

create table if not exists session_rewards (
  session_id integer primary key references workout_sessions(id) on delete cascade,
  user_id text not null,
  week_start date not null,
  xp integer not null check (xp >= 0),
  pr_xp integer not null default 0 check (pr_xp between 0 and 100),
  awarded_at timestamptz not null default now()
);
create index if not exists session_rewards_user_idx on session_rewards(user_id, week_start);
create table if not exists earned_badges (
  user_id text not null,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create or replace function forge_recompute_workouts(owner_id text) returns void language plpgsql as $$
begin
  if current_setting('forge.recomputing', true) = 'on' then return; end if;
  perform set_config('forge.recomputing', 'on', true);
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  update session_sets set is_pr = false where user_id = owner_id and is_pr;
  with estimates as (
    select s.id, lower(trim(s.exercise_name)) as exercise,
      case when s.reps = 1 then s.weight_kg else round(s.weight_kg * (1 + s.reps / 30.0), 1) end as estimate,
      coalesce(s.logged_at, w.started_at) as logged_at
    from session_sets s join workout_sessions w on w.id = s.session_id and w.user_id = s.user_id
    where s.user_id = owner_id and s.completed and not s.is_warmup and s.weight_kg > 0 and s.reps > 0
  ), records as (
    select id, estimate, max(estimate) over (
      partition by exercise order by logged_at, id rows between unbounded preceding and 1 preceding
    ) as previous_best from estimates
  )
  update session_sets s set is_pr = true from records r
  where s.id = r.id and r.estimate > coalesce(r.previous_best, 0) + 0.4;

  delete from personal_records where user_id = owner_id;
  insert into personal_records(user_id, exercise_id, exercise_name, weight_kg, reps, estimated_1rm, session_id, source_set_id, achieved_at)
  select s.user_id, s.exercise_id, s.exercise_name, s.weight_kg, s.reps,
    case when s.reps = 1 then s.weight_kg else round(s.weight_kg * (1 + s.reps / 30.0), 1) end,
    s.session_id, s.id, coalesce(s.logged_at, w.started_at)
  from session_sets s join workout_sessions w on w.id = s.session_id and w.user_id = s.user_id
  where s.user_id = owner_id and s.is_pr;

  update workout_sessions w set
    volume_kg = coalesce(a.volume, 0), set_count = a.set_count, pr_count = a.pr_count
  from (
    select w2.id, coalesce(sum(s.weight_kg * s.reps), 0) as volume,
      count(s.id)::int as set_count, count(s.id) filter (where s.is_pr)::int as pr_count
    from workout_sessions w2 left join session_sets s on s.session_id = w2.id and s.user_id = w2.user_id
      and s.completed and not s.is_warmup and s.reps > 0 and (s.weight_kg is null or s.weight_kg >= 0)
    where w2.user_id = owner_id group by w2.id
  ) a where w.id = a.id;
  perform set_config('forge.recomputing', 'off', true);
end $$;

-- User-level serialization protects PR comparisons across different sessions.
create or replace function forge_workout_lock() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || coalesce(new.user_id, old.user_id), 0));
  if tg_table_name = 'session_sets' and tg_op <> 'DELETE' then
    if not exists (select 1 from workout_sessions where id = new.session_id and user_id = new.user_id) then
      raise exception 'Session not found';
    end if;
    if new.completed then
      new.logged_at := coalesce(new.logged_at, now());
    else
      new.logged_at := null;
      new.is_pr := false;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create or replace function forge_workout_changed() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 then
    perform forge_recompute_workouts(coalesce(new.user_id, old.user_id));
  end if;
  return null;
end $$;
create trigger forge_set_lock before insert or update or delete on session_sets
for each row execute function forge_workout_lock();
create trigger forge_set_changed after insert or update or delete on session_sets
for each row execute function forge_workout_changed();
create trigger forge_session_lock before update or delete on workout_sessions
for each row execute function forge_workout_lock();
create trigger forge_session_deleted after delete on workout_sessions
for each row execute function forge_workout_changed();

create or replace function forge_log_set(owner_id text, target_id integer, weight numeric, repetitions integer,
  exertion numeric, done boolean, warmup boolean) returns integer language plpgsql as $$
declare workout_id integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  if done and (repetitions is null or repetitions <= 0) then raise exception 'Enter positive reps before logging'; end if;
  update session_sets set weight_kg = weight, reps = repetitions, rpe = exertion,
    completed = done, is_warmup = coalesce(warmup, is_warmup)
  where id = target_id and user_id = owner_id returning session_id into workout_id;
  if not found then raise exception 'Set not found'; end if;
  return workout_id;
end $$;

create or replace function forge_remove_set(owner_id text, workout_id integer, target_id integer)
returns void language plpgsql as $$
declare movement text;
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  select exercise_name into movement from session_sets
    where id = target_id and session_id = workout_id and user_id = owner_id;
  if not found then raise exception 'Set not found'; end if;
  delete from session_sets where id = target_id and session_id = workout_id and user_id = owner_id;
  with positions as (
    select id, row_number() over (order by set_index, id)::int as position from session_sets
    where session_id = workout_id and user_id = owner_id and exercise_name = movement
  ) update session_sets s set set_index = p.position from positions p where p.id = s.id;
end $$;

create or replace function forge_complete_exercise(owner_id text, workout_id integer, movement text)
returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  if not exists (select 1 from workout_sessions where id = workout_id and user_id = owner_id and completed_at is null) then
    raise exception 'No active session';
  end if;
  if not exists (select 1 from session_sets where session_id = workout_id and user_id = owner_id
    and exercise_name = movement and completed and not is_warmup and reps > 0) then
    raise exception 'Log a working set first';
  end if;
  -- Ending a movement discards suggestions; it never promotes them to real work.
  delete from session_sets where session_id = workout_id and user_id = owner_id and exercise_name = movement and not completed;
end $$;

create or replace function forge_finish_session(owner_id text, workout_id integer, details jsonb)
returns setof workout_sessions language plpgsql as $$
declare workout workout_sessions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  select * into workout from workout_sessions where id = workout_id and user_id = owner_id for update;
  if not found then raise exception 'Session not found'; end if;
  if workout.completed_at is not null then
    return next workout;
    return;
  end if;
  if not exists (select 1 from session_sets where session_id = workout_id and user_id = owner_id
    and completed and not is_warmup and reps > 0 and (weight_kg is null or weight_kg >= 0)) then
    raise exception 'Log at least one working set before finishing';
  end if;
  perform forge_recompute_workouts(owner_id);
  update workout_sessions set completed_at = now(),
    duration_sec = greatest(0, floor(extract(epoch from now() - started_at)))::int,
    notes = coalesce(details->>'notes', notes),
    energy = case when details ? 'energy' then (details->>'energy')::int else energy end,
    soreness = case when details ? 'soreness' then (details->>'soreness')::int else soreness end,
    visibility = coalesce(details->>'visibility', visibility)
  where id = workout_id and user_id = owner_id returning * into workout;
  return next workout;
end $$;

create or replace function forge_award_session(owner_id text, workout_id integer, focus_bonus integer)
returns jsonb language plpgsql as $$
declare workout workout_sessions%rowtype; reward session_rewards%rowtype; week date; pr_bonus integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('forge-workout:' || owner_id, 0));
  select * into workout from workout_sessions where id = workout_id and user_id = owner_id for update;
  if not found or workout.completed_at is null then raise exception 'Completed session not found'; end if;
  select * into reward from session_rewards where session_id = workout_id and user_id = owner_id;
  if found then return to_jsonb(reward) || jsonb_build_object('newly_awarded', false); end if;
  if not exists (select 1 from session_sets where session_id = workout_id and user_id = owner_id
    and completed and not is_warmup and reps > 0 and (weight_kg is null or weight_kg >= 0)) then
    raise exception 'Session has no completed working sets';
  end if;
  week := date_trunc('week', workout.completed_at at time zone 'UTC')::date;
  select least(workout.pr_count * 25, greatest(0, 100 - coalesce(sum(pr_xp), 0)))::int into pr_bonus
    from session_rewards where user_id = owner_id and week_start = week;
  insert into session_rewards(session_id, user_id, week_start, xp, pr_xp)
    values(workout_id, owner_id, week, 50 + pr_bonus + case when focus_bonus = 50 then 50 else 0 end, pr_bonus)
    returning * into reward;
  return to_jsonb(reward) || jsonb_build_object('newly_awarded', true);
end $$;

-- Repair existing stale PR claims and summaries against persisted source sets.
delete from personal_records where source_set_id is null;
do $$ declare owner_id text; begin
  for owner_id in select distinct user_id from workout_sessions loop
    perform forge_recompute_workouts(owner_id);
  end loop;
end $$;
alter table personal_records alter column source_set_id set not null;
