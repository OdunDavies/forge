import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num, num0 } from "@/lib/db-map";
import { epley1rm } from "@/lib/utils";
import { parseTargetReps } from "@/lib/muscles";
import { loadPlan } from "./plan";
import type { SessionSet, WorkoutSession } from "./types";

type SessionRow = {
  id: number;
  user_id: string;
  plan_day_id: number | null;
  title: string;
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  bodyweight_kg: unknown;
  energy: number | null;
  soreness: number | null;
  notes: string;
  visibility: string;
  volume_kg: unknown;
  set_count: number;
  pr_count: number;
  photo_url: string | null;
};

type SetRow = {
  id: number;
  exercise_id: string | null;
  exercise_name: string;
  set_index: number;
  weight_kg: unknown;
  reps: number | null;
  rpe: unknown;
  completed: boolean;
  is_warmup: boolean;
  is_pr: boolean;
};

function mapSet(row: SetRow): SessionSet {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    setIndex: row.set_index,
    weightKg: num(row.weight_kg),
    reps: row.reps,
    rpe: num(row.rpe),
    completed: Boolean(row.completed),
    isWarmup: Boolean(row.is_warmup),
    isPr: Boolean(row.is_pr),
  };
}

function mapSession(row: SessionRow, sets: SessionSet[]): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    planDayId: row.plan_day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSec: row.duration_sec,
    bodyweightKg: num(row.bodyweight_kg),
    energy: row.energy,
    soreness: row.soreness,
    notes: row.notes,
    visibility: row.visibility,
    volumeKg: num0(row.volume_kg),
    setCount: row.set_count,
    prCount: row.pr_count,
    photoUrl: row.photo_url,
    sets,
  };
}

async function setsFor(sessionId: number, userId: string) {
  const sql = await getSql();
  const rows = await sql<SetRow>`
    select id, exercise_id, exercise_name, set_index, weight_kg, reps, rpe, completed, is_warmup, is_pr
    from session_sets where session_id = ${sessionId} and user_id = ${userId}
    order by id`;
  return rows.map(mapSet);
}

async function lastWorkingSet(userId: string, exerciseName: string) {
  const sql = await getSql();
  const rows = await sql<{ weight_kg: unknown; reps: number | null }>`
    select weight_kg, reps from session_sets
    where user_id = ${userId}
      and lower(exercise_name) = ${exerciseName.toLowerCase()}
      and completed = true
    order by id desc
    limit 1`;
  return rows[0]
    ? { weightKg: num(rows[0].weight_kg), reps: rows[0].reps }
    : { weightKg: null as number | null, reps: null as number | null };
}

async function maybeRecordPr(
  userId: string,
  row: SetRow & { session_id: number },
  weightKg: number | null,
  reps: number | null,
) {
  if (!weightKg || !reps || reps <= 0) return false;
  const est = epley1rm(weightKg, reps);
  const sql = await getSql();
  const prev = await sql<{ estimated_1rm: unknown }>`
    select estimated_1rm from personal_records
    where user_id = ${userId} and lower(exercise_name) = ${row.exercise_name.toLowerCase()}
    order by estimated_1rm desc nulls last limit 1`;
  const best = num(prev[0]?.estimated_1rm) ?? 0;
  if (est <= best + 0.4) return false;
  await sql`
    insert into personal_records (user_id, exercise_id, exercise_name, weight_kg, reps, estimated_1rm, session_id)
    values (${userId}, ${row.exercise_id}, ${row.exercise_name}, ${weightKg}, ${reps}, ${est}, ${row.session_id})`;
  return true;
}

export const getActiveSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is null
      order by started_at desc limit 1`;
    if (!rows[0]) return null;
    return mapSession(rows[0], await setsFor(rows[0].id, context.userId));
  });

export const startTodaysSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is null
      order by started_at desc limit 1`;
    if (existing[0]) {
      return mapSession(existing[0], await setsFor(existing[0].id, context.userId));
    }

    const plan = await loadPlan(context.userId);
    const weekday = new Date().getDay();
    const today = plan?.days.find((d) => d.weekday === weekday);
    const title = today && !today.isRest ? today.title : "Open session";
    const inserted = await sql<SessionRow>`
      insert into workout_sessions (user_id, plan_day_id, title, visibility)
      values (${context.userId}, ${today?.id ?? null}, ${title}, 'public')
      returning *`;
    const session = inserted[0]!;

    if (today && !today.isRest) {
      for (const ex of today.exercises) {
        const last = await lastWorkingSet(context.userId, ex.exerciseName);
        const reps = parseTargetReps(ex.reps) ?? last.reps;
        for (let i = 1; i <= ex.sets; i++) {
          await sql`
            insert into session_sets (
              session_id, user_id, exercise_id, exercise_name, set_index, weight_kg, reps, completed, is_warmup
            ) values (
              ${session.id}, ${context.userId}, ${ex.exerciseId}, ${ex.exerciseName}, ${i},
              ${last.weightKg}, ${reps}, false, false
            )`;
        }
      }
    }
    return mapSession(session, await setsFor(session.id, context.userId));
  });

export const startEmptySession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((title?: string) => title?.slice(0, 60) ?? "Open session")
  .handler(async ({ context, data: title }) => {
    const sql = await getSql();
    const existing = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is null
      order by started_at desc limit 1`;
    if (existing[0]) return mapSession(existing[0], await setsFor(existing[0].id, context.userId));
    const inserted = await sql<SessionRow>`
      insert into workout_sessions (user_id, title, visibility)
      values (${context.userId}, ${title}, 'public')
      returning *`;
    return mapSession(inserted[0]!, []);
  });

const addExSchema = z.object({
  sessionId: z.number(),
  exerciseId: z.string().nullable().optional(),
  exerciseName: z.string().min(1),
  sets: z.number().int().min(1).max(8).optional(),
});

export const addExerciseToSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => addExSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: number }>`
      select id from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId} and completed_at is null`;
    if (!owned[0]) throw new Error("No active session");
    const count = data.sets ?? 3;
    const last = await lastWorkingSet(context.userId, data.exerciseName);
    for (let i = 1; i <= count; i++) {
      await sql`
        insert into session_sets (session_id, user_id, exercise_id, exercise_name, set_index, weight_kg, reps, completed)
        values (${data.sessionId}, ${context.userId}, ${data.exerciseId ?? null}, ${data.exerciseName}, ${i},
          ${last.weightKg}, ${last.reps ?? 8}, false)`;
    }
    const row = await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
    return mapSession(row[0]!, await setsFor(data.sessionId, context.userId));
  });

const logSetSchema = z.object({
  setId: z.number(),
  weightKg: z.number().nonnegative().nullable(),
  reps: z.number().int().nonnegative().nullable(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  completed: z.boolean(),
});

export const logSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => logSetSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await sql<SetRow & { session_id: number }>`
      select * from session_sets where id = ${data.setId} and user_id = ${context.userId} limit 1`;
    const row = current[0];
    if (!row) throw new Error("Set not found");

    const isPr = data.completed
      ? await maybeRecordPr(context.userId, row, data.weightKg, data.reps)
      : false;

    await sql`
      update session_sets
      set weight_kg = ${data.weightKg},
          reps = ${data.reps},
          rpe = ${data.rpe ?? null},
          completed = ${data.completed},
          is_pr = ${isPr}
      where id = ${data.setId} and user_id = ${context.userId}`;

    const session = await sql<SessionRow>`select * from workout_sessions where id = ${row.session_id} and user_id = ${context.userId}`;
    return { session: mapSession(session[0]!, await setsFor(row.session_id, context.userId)), isPr };
  });

const completeExSchema = z.object({
  sessionId: z.number(),
  exerciseName: z.string().min(1),
});

export const completeExercise = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => completeExSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<SessionRow>`
      select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId} and completed_at is null`;
    if (!owned[0]) throw new Error("No active session");
    const rows = await sql<SetRow & { session_id: number }>`
      select * from session_sets
      where session_id = ${data.sessionId} and user_id = ${context.userId} and exercise_name = ${data.exerciseName}`;
    let anyPr = false;
    for (const row of rows) {
      const isPr = await maybeRecordPr(context.userId, row, num(row.weight_kg), row.reps);
      if (isPr) anyPr = true;
      await sql`
        update session_sets set completed = true, is_pr = ${isPr}
        where id = ${row.id} and user_id = ${context.userId}`;
    }
    const session = await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
    return { session: mapSession(session[0]!, await setsFor(data.sessionId, context.userId)), isPr: anyPr };
  });

const finishSchema = z.object({
  sessionId: z.number(),
  notes: z.string().max(500).optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  soreness: z.number().int().min(1).max(5).nullable().optional(),
  visibility: z.enum(["public", "followers", "private"]).optional(),
});

export const finishSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => finishSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<SessionRow>`
      select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
    const session = rows[0];
    if (!session) throw new Error("Session not found");

    const pending = await sql<SetRow & { session_id: number }>`
      select * from session_sets
      where session_id = ${session.id} and user_id = ${context.userId} and completed = false`;
    for (const row of pending) {
      const isPr = await maybeRecordPr(context.userId, row, num(row.weight_kg), row.reps);
      await sql`
        update session_sets set completed = true, is_pr = ${isPr}
        where id = ${row.id} and user_id = ${context.userId}`;
    }

    const sets = await setsFor(session.id, context.userId);
    const working = sets.filter((s) => s.completed && !s.isWarmup);
    const volume = working.reduce((acc, s) => acc + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
    const prs = working.filter((s) => s.isPr).length;
    const duration = Math.max(60, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000));
    await sql`
      update workout_sessions
      set completed_at = now(),
          duration_sec = ${duration},
          notes = ${data.notes ?? session.notes},
          energy = ${data.energy ?? session.energy},
          soreness = ${data.soreness ?? session.soreness},
          visibility = ${data.visibility ?? session.visibility},
          volume_kg = ${volume},
          set_count = ${working.length},
          pr_count = ${prs}
      where id = ${session.id} and user_id = ${context.userId}`;
    const next = await sql<SessionRow>`select * from workout_sessions where id = ${session.id} and user_id = ${context.userId}`;
    return mapSession(next[0]!, sets);
  });

const photoSchema = z.object({
  sessionId: z.number(),
  photoUrl: z.string().max(420_000).nullable(),
});

export const saveSessionPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => photoSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<SessionRow>`
      update workout_sessions
      set photo_url = ${data.photoUrl}
      where id = ${data.sessionId} and user_id = ${context.userId}
      returning *`;
    if (!rows[0]) throw new Error("Session not found");
    return mapSession(rows[0], await setsFor(rows[0].id, context.userId));
  });

export const getSessionById = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<SessionRow>`select * from workout_sessions where id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    if (row.user_id !== context.userId && row.visibility === "private") return null;
    if (row.user_id !== context.userId && row.visibility === "followers") {
      const follow = await sql<{ follower_id: string }>`
        select follower_id from follows where follower_id = ${context.userId} and following_id = ${row.user_id}`;
      if (!follow[0]) return null;
    }
    return mapSession(row, await setsFor(row.id, row.user_id));
  });

export const listMyHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is not null
      order by completed_at desc limit 40`;
    return rows.map((r) => mapSession(r, []));
  });

export const getPersonalRecords = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      exercise_name: string;
      weight_kg: unknown;
      reps: number;
      estimated_1rm: unknown;
      achieved_at: string;
    }>`
      select distinct on (lower(exercise_name))
        exercise_name, weight_kg, reps, estimated_1rm, achieved_at
      from personal_records
      where user_id = ${context.userId}
      order by lower(exercise_name), estimated_1rm desc nulls last`;
    return rows.map((r) => ({
      exerciseName: r.exercise_name,
      weightKg: num(r.weight_kg) ?? 0,
      reps: r.reps,
      estimated1rm: num(r.estimated_1rm),
      achievedAt: r.achieved_at,
    }));
  });
