import { consumeAiBudget } from "@/lib/ai/rate-limit.server";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db.server";
import { num } from "@/lib/db-map";
import { extractJson, grokChat } from "@/lib/ai/grok";
import { buildFallbackPlan } from "@/lib/plan/fallback";
import { loadProfileByUserId } from "./profile";

import { matchExercise, exerciseFocusMuscles } from "@/lib/exercises/catalog";
import { suggestExercise } from "@/lib/exercises/match";
import type { ActivePlan, PlanDay, PlanExercise } from "./types";

type PlanRow = {
  id: number;
  title: string;
  split: string;
  days_per_week: number;
  focus: string;
  notes: string;
  ai_rationale: string;
};

type DayRow = {
  id: number;
  day_index: number;
  title: string;
  is_rest: boolean;
  coach_notes: string;
};

type ExRow = {
  id: number;
  plan_day_id: number;
  exercise_id: string | null;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_sec: number;
  target_rpe: unknown;
  notes: string;
  sort_order: number;
};

/** Resolve an exercise name to a catalog entry using the matcher.
 * Returns { id, name } or { id: null, name: original } if no match.
 * In lenient mode (for AI plans), relax some rules; in strict mode (for history),
 * never auto-link. */
function resolveExerciseName(
  name: string,
  lenient = false
): { id: string | null; name: string; method: "exact" | "relaxed" | "null" } {
  const result = matchExercise(name);
  if (result) return result;
  // No strict match; if lenient, try suggest()
  if (lenient) {
    const suggest = suggestExercise(name);
    if (suggest) {
      return { id: suggest.id, name: suggest.name, method: "relaxed" };
    }
  }
  return { id: null, name, method: "null" };
}

export const loadPlan = createServerOnlyFn(async (userId: string): Promise<ActivePlan | null> => {
  const sql = await getSql();
  const plans = await sql<PlanRow>`
    select id, title, split, days_per_week, focus, notes, ai_rationale
    from workout_plans where user_id = ${userId} and is_active = true
    order by created_at desc limit 1`;
  const plan = plans[0];
  if (!plan) return null;
  const days = await sql<DayRow>`
    select id, day_index, title, is_rest, coach_notes
    from plan_days where plan_id = ${plan.id} and user_id = ${userId}
    order by day_index`;
  const exercises = days.length
    ? await sql<ExRow>`
        select id, plan_day_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
        from plan_exercises where user_id = ${userId}
        order by sort_order`
    : [];
  const byDay = new Map<number, PlanExercise[]>();
  for (const e of exercises) {
    const list = byDay.get(e.plan_day_id) ?? [];
    list.push({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: e.exercise_name,
      sets: e.sets,
      reps: e.reps,
      restSec: e.rest_sec,
      targetRpe: num(e.target_rpe),
      notes: e.notes,
      sortOrder: e.sort_order,
    });
    byDay.set(e.plan_day_id, list);
  }
  return {
    id: plan.id,
    title: plan.title,
    split: plan.split,
    daysPerWeek: plan.days_per_week,
    focus: plan.focus,
    notes: plan.notes,
    aiRationale: plan.ai_rationale,
    days: days.map(
      (d): PlanDay => ({
        id: d.id,
        weekday: d.day_index,
        title: d.title,
        isRest: d.is_rest,
        coachNotes: d.coach_notes,
        exercises: byDay.get(d.id) ?? [],
      }),
    ),
  };
});

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadPlan(context.userId));

const generatedExerciseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  sets: z.number().int().min(1).max(8),
  reps: z.string().trim().min(1).max(24),
  restSec: z.number().int().min(0).max(400).optional(),
  rpe: z.number().min(5).max(10).optional(),
  notes: z.string().max(240).optional(),
});

const generatedSchema = z.object({
  title: z.string().trim().min(2).max(80),
  split: z.string().max(40).optional(),
  focus: z.string().max(120).optional(),
  rationale: z.string().max(800).optional(),
  days: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      title: z.string().trim().min(2).max(48),
      isRest: z.boolean().optional(),
      notes: z.string().max(500).optional(),
      exercises: z.array(generatedExerciseSchema).max(8).optional(),
    }),
  ),
});

async function persistGenerated(
  userId: string,
  generated: z.infer<typeof generatedSchema>,
) {
  const sql = await getSql();
  const inserted = await sql<{ id: number }>`
    insert into workout_plans (user_id, title, split, days_per_week, focus, notes, ai_rationale, is_active)
    values (
      ${userId},
      ${generated.title.slice(0, 80)},
      ${generated.split ?? ""},
      ${generated.days.filter((d) => !d.isRest).length},
      ${generated.focus ?? ""},
      ${""},
      ${generated.rationale ?? ""},
      false
    ) returning id`;
  const planId = inserted[0]!.id;

  const byWeekday = new Map(generated.days.map((d) => [d.weekday, d]));
  for (let wd = 0; wd < 7; wd++) {
    const d = byWeekday.get(wd) ?? {
      weekday: wd,
      title: "Rest",
      isRest: true,
      exercises: [],
      notes: "",
    };
    const isRest = Boolean(d.isRest) || !(d.exercises && d.exercises.length);
    const dayRows = await sql<{ id: number }>`
      insert into plan_days (plan_id, user_id, day_index, title, is_rest, coach_notes)
      values (${planId}, ${userId}, ${wd}, ${d.title.slice(0, 48)}, ${isRest}, ${d.notes ?? ""})
      returning id`;
    const dayId = dayRows[0]!.id;
    if (isRest) continue;
    let sort = 0;
    for (const ex of d.exercises ?? []) {
      // Resolve exercise name using the matcher (strict by default; lenient for AI hints)
      const match = resolveExerciseName(ex.name, /* lenient */ true);
      await sql`
        insert into plan_exercises (
          plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
        ) values (
          ${dayId}, ${userId}, ${match.id ?? null}, ${match.name},
          ${ex.sets}, ${ex.reps}, ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
        )`;
      sort += 1;
    }
  }
  // Keep the previous plan active until the replacement is fully written. If
  // generation or persistence fails halfway through, users retain a usable plan.
  await sql`update workout_plans set is_active = false where user_id = ${userId} and is_active = true`;
  await sql`update workout_plans set is_active = true where id = ${planId} and user_id = ${userId}`;
  return loadPlan(userId);
}

export const generateFirstPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfileByUserId(context.userId);
    if (!profile) throw new Error("Complete your profile first");

    await consumeAiBudget(context.userId);
    const fallback = buildFallbackPlan(profile);
    const starterPayload = {
      title: fallback.title,
      split: fallback.split,
      focus: fallback.focus,
      rationale: fallback.rationale,
      days: fallback.days.map((d) => ({
        weekday: d.weekday,
        title: d.title,
        isRest: d.isRest,
        notes: d.coachNotes,
        exercises: d.exercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          restSec: e.restSec,
          rpe: e.rpe,
          notes: e.notes ?? "",
        })),
      })),
    };
    const starter = await persistGenerated(context.userId, starterPayload);

    // Build a catalog hint from the fallback: popular/canonical names for the focus muscles
    const catalogHint = fallback.days
      .flatMap((d) => d.exercises.map((e) => e.name))
      .slice(0, 40)
      .join(", ");

    const prompt = `You are the strength coach inside Forge. Write a week of lifting for this athlete as JSON.
Profile:
${JSON.stringify({
  goal: profile.goal,
  experience: profile.experience,
  daysPerWeek: profile.daysPerWeek,
  sessionMinutes: profile.sessionMinutes,
  equipment: profile.equipment,
  injuries: profile.injuries,
  availableDays: profile.availableDays,
  focusMuscles: profile.focusMuscles,
  sex: profile.sex,
  weightKg: profile.weightKg,
})}
Rules:
- 7 days, weekday 0=Sunday ... 6=Saturday.
- Rest days on days they did not mark available.
- SPLIT is already chosen: ${fallback.split}. Use its session names (e.g. Full Body A / Upper A / Push / Chest Day) — do not rename to a different split.
- HARD VOLUME RULE: ~40% of all working sets this week must train the focus muscles (${(profile.focusMuscles ?? []).join(", ") || "none listed"}), ~60% must train other major muscle groups the split has room for (variety, not the same 2 muscles repeated). Count secondary activation (rows hit back + biceps). Keep the split's structure while placing the 60% variety work (upper variety on upper days, leg variety on leg days).
- Prefer compounds first. Respect injuries by swapping the offending pattern, never by ignoring it.
- Use exercise names close to: ${catalogHint}
- JSON shape: {"title":"...","split":"${fallback.split}","focus":"...","rationale":"2-3 sentences naming the 40/60 split","days":[{"weekday":1,"title":"${fallback.days.find((d) => !d.isRest)?.title ?? "Push"}","isRest":false,"notes":"...","exercises":[{"name":"...","sets":4,"reps":"6-8","restSec":180,"rpe":8,"notes":""}]}]}
- Keep each training day to 4-6 lifts.`;

    const ai = await grokChat(
      [
        { role: "system", content: "You output only valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 1800, json: true },
    );

    if (ai.ok) {
      try {
        const parsed = generatedSchema.parse(extractJson(ai.text));
        const focus = (profile.focusMuscles ?? []).map((m) => m.toLowerCase());
        if (parsed.split && parsed.split !== fallback.split) throw new Error("plan changed the prescribed split");
        const weekdays = parsed.days.map((d) => d.weekday);
        if (new Set(weekdays).size !== weekdays.length) throw new Error("plan repeated a weekday");
        const expectedTrainingDays = fallback.days.filter((d) => !d.isRest).map((d) => d.weekday).sort();
        const actualTrainingDays = parsed.days.filter((d) => !d.isRest && (d.exercises?.length ?? 0) > 0).map((d) => d.weekday).sort();
        if (JSON.stringify(actualTrainingDays) !== JSON.stringify(expectedTrainingDays)) throw new Error("plan ignored the athlete's available days");
        for (const day of parsed.days.filter((d) => !d.isRest)) {
          if ((day.exercises?.length ?? 0) < 4 || (day.exercises?.length ?? 0) > 6) throw new Error("training days must contain 4-6 exercises");
          for (const exercise of day.exercises ?? []) {
            if (!resolveExerciseName(exercise.name, true).id) throw new Error(`unknown exercise: ${exercise.name}`);
          }
        }
        // 40/60 volume validation – now using catalog muscle resolution instead of name substrings
        if (focus.length) {
          const allEx = parsed.days.flatMap((d) => d.exercises ?? []);
          let focusSets = 0;
          let totalSets = 0;
          // Resolve each exercise's focus muscles via the catalog and tally
          for (const ex of allEx) {
            // Find the catalog entry for this exercise name
            const resolved = resolveExerciseName(ex.name, true);
            if (resolved.id) {
              const { primary, secondary } = exerciseFocusMuscles(resolved.id);
              totalSets += ex.sets;
              // Count primary focus muscles
              const isFocus = focus.some((f) => primary.includes(f) || secondary.includes(f));
              if (isFocus) focusSets += ex.sets;
            } else {
              totalSets += ex.sets;
            }
          }
          const ratio = totalSets ? focusSets / totalSets : 0;
          if (ratio < 0.3 || ratio > 0.5) {
            console.warn(`[plan] 40/60 proxy failed: focus ratio ${ratio.toFixed(2)} outside 0.30-0.50, falling back`);
            throw new Error(`focus ratio ${ratio.toFixed(2)} outside 0.30-0.50`);
          }
        }
        const plan = await persistGenerated(context.userId, parsed);
        return { plan, source: "ai" as const };
      } catch (error) {
        console.warn("[plan] rejected AI-generated plan; keeping validated starter", {
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { plan: starter, source: "starter" as const };
  });

const tweakSchema = z.object({
  reason: z.string().max(400).optional(),
  preview: z.boolean().optional(),
});

const confirmTweakSchema = z.object({
  exercises: z.array(generatedExerciseSchema).min(1).max(8),
  message: z.string().max(500).optional(),
  targetWeekday: z.number().int().min(0).max(6).optional(),
});

export const tweakTodayPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => tweakSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const profile = await loadProfileByUserId(context.userId);
    const plan = await loadPlan(context.userId);
    if (!profile || !plan) throw new Error("No active plan");
    const weekday = new Date().getDay();
    const today = plan.days.find((d) => d.weekday === weekday);
    let target = today && !today.isRest ? today : undefined;
    if (!target) {
      for (let i = 1; i <= 7; i++) {
        const day = plan.days.find((d) => d.weekday === (weekday + i) % 7 && !d.isRest);
        if (day) {
          target = day;
          break;
        }
      }
    }
    if (!target) return { plan, message: "No training day to retune." };

    const sql = await getSql();
    const recent = await sql<{ title: string; notes: string; volume_kg: unknown; started_at: string }>`
      select title, notes, volume_kg, started_at from workout_sessions
      where user_id = ${context.userId} and completed_at is not null
      order by completed_at desc limit 5`;

    await consumeAiBudget(context.userId);
    const ai = await grokChat(
      [
        {
          role: "system",
          content: "You are Forge, a conservative strength coach. Output JSON only.",
        },
        {
          role: "user",
          content: `Adjust this upcoming session only (${target.title}).
Injuries: ${profile.injuries || "none"}
Goal and focus: ${profile.goal || "general"}; ${(profile.focusMuscles ?? []).join(", ") || "balanced"}
Experience: ${profile.experience || "intermediate"}
Available equipment: ${(profile.equipment ?? []).join(", ") || "body only"}
Energy/soreness notes: ${data.reason ?? "none"}
Recent sessions: ${JSON.stringify(recent)}
Session: ${JSON.stringify(target)}
Return {"message":"one paragraph to the athlete","exercises":[{"name":"...","sets":3,"reps":"8","restSec":90,"rpe":7,"notes":""}]}
Use only the available equipment and catalog-style exercise names. Preserve the session's movement balance unless pain or equipment requires a swap.
If they are beat up, cut volume. If they crushed last time, add a small load cue in notes, not extra junk volume.`,
        },
      ],
      { maxTokens: 900, json: true },
    );

    if (!ai.ok) {
      console.warn("[plan] grokChat tweak failed", { userId: context.userId, error: ai.error, retryable: true });
      return { plan, message: ai.error, retryable: true as const, offline: true as const };
    }
    try {
      const parsed = z
        .object({
          message: z.string().trim().min(1).max(500),
          exercises: z.array(generatedExerciseSchema).min(1).max(8),
        })
        .parse(extractJson(ai.text));

      const currentNames = new Set(target.exercises.map((exercise) => exercise.exerciseName.trim().toLowerCase()));
      for (const exercise of parsed.exercises) {
        if (!resolveExerciseName(exercise.name, true).id && !currentNames.has(exercise.name.trim().toLowerCase())) {
          throw new Error(`unknown exercise: ${exercise.name}`);
        }
      }

      if (data.preview) {
        return {
          plan,
          message: parsed.message,
          preview: parsed.exercises.slice(0, 8),
          targetDayId: target.id,
          targetTitle: target.title,
          retryable: false as const,
        };
      }

      await sql`delete from plan_exercises where plan_day_id = ${target.id} and user_id = ${context.userId}`;
      let sort = 0;
      for (const ex of parsed.exercises.slice(0, 8)) {
        const match = resolveExerciseName(ex.name, /* lenient */ true);
        await sql`
          insert into plan_exercises (
            plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
          ) values (
            ${target.id}, ${context.userId}, ${match.id ?? null}, ${match.name},
            ${ex.sets}, ${ex.reps}, ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
          )`;
        sort += 1;
      }
      await sql`update plan_days set coach_notes = ${parsed.message.slice(0, 500)} where id = ${target.id} and user_id = ${context.userId}`;
      return { plan: await loadPlan(context.userId), message: parsed.message, retryable: false as const };
    } catch (e) {
      console.warn("[plan] tweak parse failed", { error: String(e), retryable: true });
      return { plan, message: "Coach could not apply a structured tweak. Try again.", retryable: true as const };
    }
  });

export const confirmTweak = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => confirmTweakSchema.parse(input))
  .handler(async ({ context, data }) => {
    const plan = await loadPlan(context.userId);
    if (!plan) throw new Error("No active plan");
    let target: typeof plan.days[number] | undefined;
    if (data.targetWeekday !== undefined) {
      target = plan.days.find((d) => d.weekday === data.targetWeekday);
    } else {
      const weekday = new Date().getDay();
      target = plan.days.find((d) => d.weekday === weekday && !d.isRest);
      if (!target) {
        for (let i = 1; i <= 7; i++) {
          const day = plan.days.find((d) => d.weekday === (weekday + i) % 7 && !d.isRest);
          if (day) { target = day; break; }
        }
      }
    }
    if (!target || target.isRest) throw new Error("Choose an active training day to retune.");
    const sql = await getSql();
    await sql`delete from plan_exercises where plan_day_id = ${target.id} and user_id = ${context.userId}`;
    let sort = 0;
    for (const ex of data.exercises.slice(0, 8)) {
      const match = resolveExerciseName(ex.name, /* lenient */ true);
      await sql`
        insert into plan_exercises (
          plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
        ) values (
          ${target.id}, ${context.userId}, ${match.id ?? null}, ${match.name},
          ${ex.sets}, ${ex.reps}, ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
        )`;
      sort += 1;
    }
    if (data.message) {
      await sql`update plan_days set coach_notes = ${data.message.slice(0, 500)} where id = ${target.id} and user_id = ${context.userId}`;
    }
    return { plan: await loadPlan(context.userId), message: data.message ?? "Plan updated." };
  });
