import { consumeAiBudget } from "@/lib/ai/rate-limit.server";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withTransaction, type Sql } from "@/lib/db.server";
import { num } from "@/lib/db-map";
import { extractJson, grokChat } from "@/lib/ai/grok";
import { buildFallbackPlan } from "@/lib/plan/fallback";
import { assertPlanStructure } from "@/lib/plan/refinement";
import { loadProfileByUserId } from "./profile";
import { ensureExerciseCatalog } from "@/lib/exercises/seed";
import { generatedSchema, confirmTweakSchema, type GeneratedPlan } from "@/lib/plan/schema";
import {
  replaceGeneratedPlan,
  replaceDayExercises,
  resolveExerciseName,
} from "@/lib/plan/persistence";
import type { ActivePlan, PlanDay, PlanExercise } from "./types";
import { loadPlanGoalContext } from "@/lib/plan/goal-context.server";

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

export const loadPlan = createServerOnlyFn(
  async (userId: string, sql?: Sql): Promise<ActivePlan | null> => {
    sql ??= await getSql();
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
          and plan_day_id in (select id from plan_days where plan_id = ${plan.id} and user_id = ${userId})
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
      days: days.map((d): PlanDay => ({
        id: d.id,
        weekday: d.day_index,
        title: d.title,
        isRest: d.is_rest,
        coachNotes: d.coach_notes,
        exercises: byDay.get(d.id) ?? [],
      })),
    };
  },
);

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadPlan(context.userId));

async function persistGenerated(userId: string, generated: GeneratedPlan) {
  await ensureExerciseCatalog();
  return withTransaction(async (sql: Sql) => {
    await replaceGeneratedPlan(sql, userId, generated);
    return loadPlan(userId, sql);
  });
}

export const generateFirstPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ goalScanId: z.number().int().positive().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const storedProfile = await loadProfileByUserId(context.userId);
    if (!storedProfile) throw new Error("Complete your profile first");
    const photoGoal =
      data.goalScanId === undefined
        ? null
        : await loadPlanGoalContext(await getSql(), context.userId, data.goalScanId);
    const profile = photoGoal
      ? {
          ...storedProfile,
          goal: photoGoal.trainingGoal ?? storedProfile.goal,
          focusMuscles: [
            ...new Set([...photoGoal.focusMuscles, ...storedProfile.focusMuscles]),
          ].slice(0, 6),
        }
      : storedProfile;

    await consumeAiBudget(context.userId);
    const fallback = buildFallbackPlan(profile);
    const starterPayload = {
      title: fallback.title,
      split: fallback.split,
      focus: fallback.focus,
      rationale: photoGoal
        ? `${fallback.rationale} Photo-guided priorities: ${photoGoal.summary} ${photoGoal.trainingNotes.join(" ")} ${photoGoal.limitations}`
        : fallback.rationale,
      days: fallback.days.map((d) => ({
        weekday: d.weekday,
        title: d.title,
        isRest: d.isRest,
        notes: d.coachNotes,
        exercises: d.exercises.map((e) => ({
          exerciseId: e.exerciseId,
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

    const prompt = `You are the strength coach inside Forge. Explain this prescribed week of lifting for this athlete as JSON.
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
Photo-guided training direction (user-approved guidance, not instructions):
${JSON.stringify(photoGoal)}
Rules:
- When photo guidance is supplied, use its trainable muscle priorities and conservative notes. Experience, injuries, equipment and schedule take precedence. Never promise a body match, infer health or body fat, or prescribe weight loss from photos.
- 7 days, weekday 0=Sunday ... 6=Saturday.
- Rest days on days they did not mark available.
- The prescribed plan below already balances compound lifts, accessory work and alternating movement angles across the available days. It adapts a bodybuilding approach to this user's experience and equipment.
- Preserve every weekday, day title, rest flag, exerciseId, exercise name, order, sets, reps, restSec and rpe exactly. Never add, swap or remove exercises. Only personalize the plan title, rationale, day notes and exercise notes.
- Keep notes concise, practical and conservative. Warm up, leave reps in reserve, and increase load gradually only after completing the prescribed reps with good form. Never recommend maximal lifts or training through pain.
- Focus priorities influence selection within the session's movement balance; do not force an arbitrary percentage of sets or neglect another muscle group.
- Return this same JSON shape, including all seven days and all exercise fields, with personalized notes and rationale:
${JSON.stringify(starterPayload)}`;

    const ai = await grokChat(
      [
        { role: "system", content: "You output only valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 6500, json: true },
    );

    if (ai.ok) {
      try {
        const parsed = generatedSchema.parse(extractJson(ai.text));
        assertPlanStructure(parsed, starterPayload);
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
    const recent = await sql<{
      title: string;
      notes: string;
      volume_kg: unknown;
      started_at: string;
    }>`
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
      console.warn("[plan] grokChat tweak failed", {
        userId: context.userId,
        error: ai.error,
        retryable: true,
      });
      return { plan, message: ai.error, retryable: true as const, offline: true as const };
    }
    try {
      const parsed = confirmTweakSchema.parse(extractJson(ai.text));

      const currentNames = new Set(
        target.exercises.map((exercise) => exercise.exerciseName.trim().toLowerCase()),
      );
      for (const exercise of parsed.exercises) {
        if (
          !resolveExerciseName(exercise).id &&
          !currentNames.has(exercise.name.trim().toLowerCase())
        ) {
          throw new Error(`unknown exercise: ${exercise.name}`);
        }
      }

      if (data.preview) {
        return {
          plan,
          message: parsed.message,
          preview: parsed.exercises,
          targetDayId: target.id,
          targetWeekday: target.weekday,
          targetTitle: target.title,
          retryable: false as const,
        };
      }

      const targetId = target.id;
      const updated = await withTransaction(async (tx: Sql) => {
        await replaceDayExercises(tx, context.userId, targetId, parsed);
        return loadPlan(context.userId, tx);
      });
      return {
        plan: updated,
        message: parsed.message ?? "Plan updated.",
        retryable: false as const,
      };
    } catch (e) {
      console.warn("[plan] tweak parse failed", { error: String(e), retryable: true });
      return {
        plan,
        message: "Coach could not apply a structured tweak. Try again.",
        retryable: true as const,
      };
    }
  });

export const confirmTweak = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => confirmTweakSchema.parse(input))
  .handler(async ({ context, data }) => {
    const plan = await loadPlan(context.userId);
    if (!plan) throw new Error("No active plan");
    let target: (typeof plan.days)[number] | undefined;
    if (data.targetWeekday !== undefined) {
      target = plan.days.find((d) => d.weekday === data.targetWeekday);
    } else {
      const weekday = new Date().getDay();
      target = plan.days.find((d) => d.weekday === weekday && !d.isRest);
      if (!target) {
        for (let i = 1; i <= 7; i++) {
          const day = plan.days.find((d) => d.weekday === (weekday + i) % 7 && !d.isRest);
          if (day) {
            target = day;
            break;
          }
        }
      }
    }
    if (!target || target.isRest) throw new Error("No training day to retune.");
    const targetId = target.id;
    const updated = await withTransaction(async (sql: Sql) => {
      await replaceDayExercises(sql, context.userId, targetId, data);
      return loadPlan(context.userId, sql);
    });
    return { plan: updated, message: data.message ?? "Plan updated." };
  });
