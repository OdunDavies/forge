import type { Sql } from "../db.ts";
import { getExercise, matchExercise, suggestExercise } from "../exercises/catalog.ts";
import type { GeneratedExercise } from "./schema.ts";
import { generatedSchema, confirmTweakSchema, type GeneratedPlan } from "./schema.ts";

export function resolveExerciseName(ex: Pick<GeneratedExercise, "exerciseId" | "name">) {
  if (ex.exerciseId) {
    const entry = getExercise(ex.exerciseId);
    if (!entry || entry.kind !== "strength" || entry.name !== ex.name)
      throw new Error("Invalid catalog exercise");
    return { id: entry.id, name: entry.name };
  }
  const match = matchExercise(ex.name) ?? suggestExercise(ex.name);
  return match ?? { id: null, name: ex.name };
}

async function insertExercises(
  sql: Sql,
  userId: string,
  dayId: number,
  exercises: GeneratedExercise[],
) {
  for (const [sort, ex] of exercises.entries()) {
    const match = resolveExerciseName(ex);
    await sql`insert into plan_exercises (
      plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
    ) values (
      ${dayId}, ${userId}, ${match.id}, ${match.name}, ${ex.sets}, ${ex.reps},
      ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
    )`;
  }
}

/** Call only inside withTransaction; the profile lock serializes same-user writes. */
export async function replaceGeneratedPlan(
  sql: Sql,
  userId: string,
  input: GeneratedPlan,
): Promise<number> {
  const generated = generatedSchema.parse(input);
  const profile = await sql`select user_id from profiles where user_id = ${userId} for update`;
  if (!profile.length) throw new Error("Complete your profile first");
  await sql`update workout_plans set is_active = false where user_id = ${userId} and is_active = true`;
  const inserted = await sql<{ id: number }>`insert into workout_plans (
    user_id, title, split, days_per_week, focus, notes, ai_rationale, is_active
  ) values (
    ${userId}, ${generated.title.slice(0, 80)}, ${generated.split ?? ""},
    ${generated.days.filter((d) => !d.isRest && d.exercises?.length).length},
    ${generated.focus ?? ""}, ${""}, ${generated.rationale ?? ""}, true
  ) returning id`;
  const planId = inserted[0].id;
  const byWeekday = new Map(generated.days.map((d) => [d.weekday, d]));
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = byWeekday.get(weekday);
    const isRest = Boolean(day?.isRest) || !day?.exercises?.length;
    const insertedDay = await sql<{ id: number }>`insert into plan_days (
      plan_id, user_id, day_index, title, is_rest, coach_notes
    ) values (
      ${planId}, ${userId}, ${weekday}, ${isRest ? "Rest" : day!.title.slice(0, 48)},
      ${isRest}, ${day?.notes ?? ""}
    ) returning id`;
    if (!isRest) await insertExercises(sql, userId, insertedDay[0].id, day!.exercises!);
  }
  return planId;
}

/** Atomic replacement with ownership and stale-plan checks on the same client. */
export async function replaceDayExercises(
  sql: Sql,
  userId: string,
  dayId: number,
  input: { exercises: GeneratedExercise[]; message?: string },
): Promise<void> {
  const data = confirmTweakSchema.parse(input);
  await sql`select user_id from profiles where user_id = ${userId} for update`;
  const days = await sql<{ id: number }>`select d.id from plan_days d
    join workout_plans p on p.id = d.plan_id
    where d.id = ${dayId} and d.user_id = ${userId} and p.user_id = ${userId}
      and p.is_active = true and d.is_rest = false for update of d`;
  if (!days.length) throw new Error("Training day is no longer active");
  await sql`delete from plan_exercises where plan_day_id = ${dayId} and user_id = ${userId}`;
  await insertExercises(sql, userId, dayId, data.exercises);
  if (data.message !== undefined) {
    await sql`update plan_days set coach_notes = ${data.message.slice(0, 500)}
      where id = ${dayId} and user_id = ${userId}`;
  }
}
