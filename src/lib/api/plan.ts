import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num } from "@/lib/db-map";
import { extractJson, grokChat } from "@/lib/ai/grok";
import { findExerciseByName } from "@/lib/exercises/seed";
import { buildFallbackPlan } from "@/lib/plan/fallback";
import { loadProfileByUserId } from "./profile";
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

export async function loadPlan(userId: string): Promise<ActivePlan | null> {
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
}

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadPlan(context.userId));

const generatedSchema = z.object({
  title: z.string(),
  split: z.string().optional(),
  focus: z.string().optional(),
  rationale: z.string().optional(),
  days: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      title: z.string(),
      isRest: z.boolean().optional(),
      notes: z.string().optional(),
      exercises: z
        .array(
          z.object({
            name: z.string(),
            sets: z.number().int().min(1).max(8),
            reps: z.string(),
            restSec: z.number().int().min(0).max(400).optional(),
            rpe: z.number().min(5).max(10).optional(),
            notes: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});

async function persistGenerated(
  userId: string,
  generated: z.infer<typeof generatedSchema>,
) {
  const sql = await getSql();
  await sql`update workout_plans set is_active = false where user_id = ${userId} and is_active = true`;
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
      true
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
      const match = await findExerciseByName(ex.name);
      await sql`
        insert into plan_exercises (
          plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
        ) values (
          ${dayId}, ${userId}, ${match?.id ?? null}, ${match?.name ?? ex.name},
          ${ex.sets}, ${ex.reps}, ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
        )`;
      sort += 1;
    }
  }
  return loadPlan(userId);
}

export const generateFirstPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfileByUserId(context.userId);
    if (!profile) throw new Error("Complete your profile first");

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
        const titles = parsed.days.filter((d) => !d.isRest).map((d) => d.title.toLowerCase()).join(" ");
        const named = focus.filter((m) => titles.includes(m));
        if (focus.length && named.length === 0) throw new Error("plan ignored focus");
        const plan = await persistGenerated(context.userId, parsed);
        return { plan, source: "ai" as const };
      } catch {
        /* keep starter */
      }
    }

    return { plan: starter, source: "starter" as const };
  });

const tweakSchema = z.object({
  reason: z.string().max(400).optional(),
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
    const planRows = await sql<{ plan: string }>`
      select plan from profiles where user_id = ${context.userId} limit 1`;
    if (planRows[0]?.plan !== "pro") {
      throw new Error("Daily retunes are Pro. Upgrade to keep Forge rewriting sessions from your log.");
    }
    const recent = await sql<{ title: string; notes: string; volume_kg: unknown; started_at: string }>`
      select title, notes, volume_kg, started_at from workout_sessions
      where user_id = ${context.userId} and completed_at is not null
      order by completed_at desc limit 5`;

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
Energy/soreness notes: ${data.reason ?? "none"}
Recent sessions: ${JSON.stringify(recent)}
Session: ${JSON.stringify(target)}
Return {"message":"one paragraph to the athlete","exercises":[{"name":"...","sets":3,"reps":"8","restSec":90,"rpe":7,"notes":""}]}
If they are beat up, cut volume. If they crushed last time, add a small load cue in notes, not extra junk volume.`,
        },
      ],
      { maxTokens: 900, json: true },
    );

    if (!ai.ok) return { plan, message: ai.error };
    try {
      const parsed = z
        .object({
          message: z.string(),
          exercises: z.array(
            z.object({
              name: z.string(),
              sets: z.number(),
              reps: z.string(),
              restSec: z.number().optional(),
              rpe: z.number().optional(),
              notes: z.string().optional(),
            }),
          ),
        })
        .parse(extractJson(ai.text));

      await sql`delete from plan_exercises where plan_day_id = ${target.id} and user_id = ${context.userId}`;
      let sort = 0;
      for (const ex of parsed.exercises.slice(0, 8)) {
        const match = await findExerciseByName(ex.name);
        await sql`
          insert into plan_exercises (
            plan_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_sec, target_rpe, notes, sort_order
          ) values (
            ${target.id}, ${context.userId}, ${match?.id ?? null}, ${match?.name ?? ex.name},
            ${ex.sets}, ${ex.reps}, ${ex.restSec ?? 90}, ${ex.rpe ?? null}, ${ex.notes ?? ""}, ${sort}
          )`;
        sort += 1;
      }
      await sql`update plan_days set coach_notes = ${parsed.message.slice(0, 500)} where id = ${target.id} and user_id = ${context.userId}`;
      return { plan: await loadPlan(context.userId), message: parsed.message };
    } catch {
      return { plan, message: "Coach could not apply a structured tweak. Try again." };
    }
  });
