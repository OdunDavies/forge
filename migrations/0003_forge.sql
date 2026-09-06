-- Focus muscles for plan emphasis; session photos for recap sharing.
alter table profiles add column if not exists focus_muscles text[] not null default '{}';
alter table workout_sessions add column if not exists photo_url text;
