import type { Sql } from "../db";
import type { WorkoutSession } from "../api/types";
import { asStringArray } from "../db-map.ts";
import type { MuscleResolver, ScoreProfile } from "./compute";

/** One snapshot includes actual sets, not cached summaries or profile placeholders. */
export async function loadScoreData(
  sql: Sql,
  userId: string,
): Promise<{ profile: ScoreProfile | null; sessions: WorkoutSession[]; resolve: MuscleResolver }> {
  const profiles = await sql<{
    sex: string | null;
    experience: string | null;
    days_per_week: number;
    focus_muscles: unknown;
  }>`
    select sex, experience, days_per_week, focus_muscles from profiles where user_id = ${userId}`;
  const sessions = await sql<WorkoutSession>`
    select w.id, w.user_id as "userId", w.title, w.plan_day_id as "planDayId",
      w.started_at::text as "startedAt", w.completed_at::text as "completedAt", w.duration_sec as "durationSec",
      w.bodyweight_kg::float8 as "bodyweightKg", w.energy, w.soreness, w.notes, w.visibility,
      w.volume_kg::float8 as "volumeKg", w.set_count as "setCount", w.pr_count as "prCount", w.photo_url as "photoUrl",
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'exerciseId', s.exercise_id, 'exerciseName', s.exercise_name,
        'setIndex', s.set_index, 'weightKg', s.weight_kg::float8, 'reps', s.reps,
        'rpe', s.rpe::float8, 'completed', s.completed, 'isWarmup', s.is_warmup, 'isPr', s.is_pr
      ) order by s.id) from session_sets s where s.session_id = w.id and s.user_id = w.user_id), '[]'::jsonb) as sets
    from workout_sessions w where w.user_id = ${userId} and w.completed_at is not null
    order by w.completed_at, w.id`;
  const muscles = await sql<{ id: string; primary_muscles: unknown; secondary_muscles: unknown }>`
    select e.id, e.primary_muscles, e.secondary_muscles from exercises e
    where exists (select 1 from session_sets s where s.user_id = ${userId} and s.exercise_id = e.id and s.completed and not s.is_warmup)`;
  const catalog = new Map(
    muscles.map((e) => [
      e.id,
      { primary: asStringArray(e.primary_muscles), secondary: asStringArray(e.secondary_muscles) },
    ]),
  );
  const row = profiles[0];
  return {
    profile: row
      ? {
          sex: row.sex,
          experience: row.experience,
          daysPerWeek: row.days_per_week,
          focusMuscles: asStringArray(row.focus_muscles),
        }
      : null,
    sessions,
    resolve: (id) => catalog.get(id) ?? { primary: [], secondary: [] },
  };
}
