-- 0008: Exercise catalog from hasaneyldrm/exercises-dataset
-- Adds new columns to the `exercises` table and an aliases table.
-- Idempotent / PGLite-safe: uses `if not exists` / `alter table ... add column if not exists`.

-- Extend `exercises` with catalog metadata columns
alter table exercises add column if not exists slug text;
alter table exercises add column if not exists source_name text;
alter table exercises add column if not exists canonical_id text;
alter table exercises add column if not exists kind text not null default 'strength'
  check (kind in ('strength','cardio','stretch','mobility'));
alter table exercises add column if not exists advanced boolean not null default false;
alter table exercises add column if not exists body_part text;
alter table exercises add column if not exists equipment_group text[] not null default '{}';
alter table exercises add column if not exists focus_primary text[] not null default '{}';
alter table exercises add column if not exists focus_secondary text[] not null default '{}';
alter table exercises add column if not exists gif_path text;
alter table exercises add column if not exists image_path text;
alter table exercises add column if not exists media_id text;
alter table exercises add column if not exists attribution text not null default '';
alter table exercises add column if not exists catalog_version text not null default '0008';

-- Indexes for the new columns
create index if not exists exercises_slug_idx on exercises (slug);
create index if not exists exercises_canonical_id_idx on exercises (canonical_id);
create index if not exists exercises_kind_idx on exercises (kind);
create index if not exists exercises_body_part_idx on exercises (body_part);
create index if not exists exercises_equipment_group_idx on exercises using gin (equipment_group);

-- Alias table: `equivalent` aliases (validated at index build:
--   unknown / non-canonical / non-strength ids throw,
--   aliases never override a different exact name.)
create table if not exists exercise_aliases (
  alias_key text primary key,
  exercise_id text not null references exercises (id) on delete cascade,
  kind text not null check (kind in ('strength','cardio','stretch','mobility'))
);
create index if not exists exercise_aliases_exercise_id_idx on exercise_aliases (exercise_id);

-- `closest` aliases: used ONLY when generating plans (the catalog name is what the user sees).
-- NEVER used to rewrite existing history.
create table if not exists exercise_closest_aliases (
  alias_key text primary key,
  exercise_id text not null references exercises (id) on delete cascade,
  kind text not null check (kind in ('strength','cardio','stretch','mobility'))
);
create index if not exists exercise_closest_aliases_exercise_id_idx on exercise_closest_aliases (exercise_id);

-- Catalog metadata: tracks which version of the catalog is loaded.
create table if not exists catalog_meta (
  key text primary key,
  value text not null
);
insert into catalog_meta (key, value) values ('catalog_version', '0008') on conflict (key) do update set value = excluded.value;

-- Keep custom `user_exercises` untouched (no changes).