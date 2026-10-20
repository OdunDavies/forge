import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withTransaction, type Sql } from "@/lib/db.server";
import { num, num0 } from "@/lib/db-map";
import { parseTargetReps } from "@/lib/muscles";
import { loadPlan } from "./plan";
import { awardSession } from "@/lib/gamification/progression.server";
import { activityVisibilitySql } from "./activity-visibility";
import type { SessionSet, WorkoutSession } from "./types";
export type { WorkoutSession } from "./types";

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
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
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

async function setsFor(sessionId: number, userId: string, transaction?: Sql) {
  const sql = transaction ?? (await getSql());
  const rows = await sql<SetRow>`
    select id, exercise_id, exercise_name, set_index, weight_kg, reps, rpe, completed, is_warmup, is_pr
    from session_sets where session_id = ${sessionId} and user_id = ${userId}
    order by id`;
  return rows.map(mapSet);
}

async function lastWorkingSet(userId: string, exerciseName: string, transaction?: Sql) {
  const sql = transaction ?? (await getSql());
  const rows = await sql<{ weight_kg: unknown; reps: number | null }>`
    select s.weight_kg, s.reps from session_sets s
    join workout_sessions w on w.id = s.session_id and w.user_id = s.user_id
    where s.user_id = ${userId}
      and lower(s.exercise_name) = ${exerciseName.toLowerCase()}
      and s.completed and not s.is_warmup and s.reps > 0 and w.completed_at is not null
    order by w.completed_at desc, s.id desc
    limit 1`;
  return rows[0]
    ? { weightKg: num(rows[0].weight_kg), reps: rows[0].reps }
    : { weightKg: null as number | null, reps: null as number | null };
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
    const plan = await loadPlan(context.userId);
    return withTransaction(async (sql: Sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + context.userId}, 0))`;
      const existing = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is null
      order by started_at desc limit 1`;
      if (existing[0]) {
        return mapSession(existing[0], await setsFor(existing[0].id, context.userId, sql));
      }

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
          const last = await lastWorkingSet(context.userId, ex.exerciseName, sql);
          const reps = parseTargetReps(ex.reps) ?? last.reps;
          await sql`
          insert into session_sets (
            session_id, user_id, exercise_id, exercise_name, set_index, weight_kg, reps, completed, is_warmup
          ) values (
            ${session.id}, ${context.userId}, ${ex.exerciseId}, ${ex.exerciseName}, 1,
            ${last.weightKg}, ${reps}, false, false
          )`;
        }
      }
      return mapSession(session, await setsFor(session.id, context.userId, sql));
    });
  });

export const startEmptySession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (title: unknown) => z.string().trim().min(1).max(60).optional().parse(title) ?? "Open session",
  )
  .handler(async ({ context, data: title }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + context.userId}, 0))`;
      const existing = await sql<SessionRow>`
      select * from workout_sessions
      where user_id = ${context.userId} and completed_at is null
      order by started_at desc limit 1`;
      if (existing[0])
        return mapSession(existing[0], await setsFor(existing[0].id, context.userId, sql));
      const inserted = await sql<SessionRow>`
      insert into workout_sessions (user_id, title, visibility)
      values (${context.userId}, ${title}, 'public')
      returning *`;
      return mapSession(inserted[0]!, []);
    }),
  );

const addExSchema = z.object({
  sessionId: z.number().int().positive(),
  exerciseId: z.string().nullable().optional(),
  exerciseName: z.string().trim().min(2).max(80),
  sets: z.number().int().min(1).max(8).optional(),
});

export const addExerciseToSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => addExSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + context.userId}, 0))`;
      const owned = await sql<{ id: number }>`
      select id from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId} and completed_at is null`;
      if (!owned[0]) throw new Error("No active session");
      const already = await sql<{ id: number }>`
      select id from session_sets
      where session_id = ${data.sessionId} and user_id = ${context.userId}
         and lower(trim(exercise_name)) = lower(trim(${data.exerciseName}))
      limit 1`;
      if (already[0]) throw new Error("That lift is already in this session");
      const last = await lastWorkingSet(context.userId, data.exerciseName, sql);
      if (!data.exerciseId) {
        await sql`
        insert into user_exercises (user_id, name)
        select ${context.userId}, ${data.exerciseName}
        where not exists (
          select 1 from user_exercises
          where user_id = ${context.userId} and lower(name) = lower(${data.exerciseName})
        )`;
      }
      await sql`
      insert into session_sets (session_id, user_id, exercise_id, exercise_name, set_index, weight_kg, reps, completed)
      values (${data.sessionId}, ${context.userId}, ${data.exerciseId ?? null}, ${data.exerciseName}, 1,
        ${last.weightKg}, ${last.reps ?? 8}, false)`;
      const row =
        await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
      return mapSession(row[0]!, await setsFor(data.sessionId, context.userId, sql));
    }),
  );

export const listMyLifts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      insert into user_exercises (user_id, name)
      select ${context.userId}, s.exercise_name
      from (
        select distinct on (lower(exercise_name)) exercise_name
        from session_sets
        where user_id = ${context.userId} and exercise_id is null
        order by lower(exercise_name), id desc
      ) s
      where not exists (
        select 1 from user_exercises u
        where u.user_id = ${context.userId} and lower(u.name) = lower(s.exercise_name)
      )`;
    const rows = await sql<{ name: string }>`
      select name from user_exercises
      where user_id = ${context.userId}
      order by created_at desc
      limit 40`;
    return rows.map((r) => r.name);
  });

const addSetSchema = z.object({
  sessionId: z.number().int().positive(),
  exerciseName: z.string().min(1),
});

export const addSetToSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => addSetSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + context.userId}, 0))`;
      const owned = await sql<{ id: number }>`
      select id from workout_sessions
      where id = ${data.sessionId} and user_id = ${context.userId} and completed_at is null`;
      if (!owned[0]) throw new Error("No active session");
      const existing = await sql<SetRow>`
      select id, exercise_id, exercise_name, set_index, weight_kg, reps, rpe, completed, is_warmup, is_pr
      from session_sets
      where session_id = ${data.sessionId} and user_id = ${context.userId}
        and exercise_name = ${data.exerciseName}
      order by set_index desc, id desc`;
      if (!existing[0]) throw new Error("Add the movement first");
      if (existing.length >= 12) throw new Error("That’s enough sets for this lift");
      if (existing.some((s) => !s.completed)) throw new Error("Log this set first");
      const last = existing[0];
      const nextIndex = (last.set_index ?? existing.length) + 1;
      await sql`
      insert into session_sets (
        session_id, user_id, exercise_id, exercise_name, set_index, weight_kg, reps, completed, is_warmup
      ) values (
        ${data.sessionId}, ${context.userId}, ${last.exercise_id}, ${data.exerciseName}, ${nextIndex},
        ${last.weight_kg}, ${last.reps}, false, false
      )`;
      const added =
        await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
      return mapSession(added[0]!, await setsFor(data.sessionId, context.userId, sql));
    }),
  );

const removeSetSchema = z.object({
  sessionId: z.number().int().positive(),
  setId: z.number().int().positive(),
});

export const removeSetFromSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => removeSetSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select forge_remove_set(${context.userId}, ${data.sessionId}, ${data.setId})`;
      const session =
        await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
      return mapSession(session[0]!, await setsFor(data.sessionId, context.userId, sql));
    }),
  );

const logSetSchema = z.object({
  setId: z.number().int().positive(),
  weightKg: z.number().finite().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  completed: z.boolean(),
  isWarmup: z.boolean().optional(),
});

export const logSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => logSetSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      const result = await sql<{ session_id: number }>`select forge_log_set(
      ${context.userId}, ${data.setId}, ${data.weightKg}, ${data.reps}, ${data.rpe ?? null}, ${data.completed}, ${data.isWarmup ?? null}
    ) as session_id`;
      const sessionId = result[0]!.session_id;
      const session =
        await sql<SessionRow>`select * from workout_sessions where id = ${sessionId} and user_id = ${context.userId}`;
      const sets = await setsFor(sessionId, context.userId, sql);
      return {
        session: mapSession(session[0]!, sets),
        isPr: sets.find((s) => s.id === data.setId)?.isPr ?? false,
      };
    }),
  );

const completeExSchema = z.object({
  sessionId: z.number().int().positive(),
  exerciseName: z.string().min(1),
});

export const completeExercise = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => completeExSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select forge_complete_exercise(${context.userId}, ${data.sessionId}, ${data.exerciseName})`;
      const session =
        await sql<SessionRow>`select * from workout_sessions where id = ${data.sessionId} and user_id = ${context.userId}`;
      return {
        session: mapSession(session[0]!, await setsFor(data.sessionId, context.userId, sql)),
        isPr: false,
      };
    }),
  );

const finishSchema = z.object({
  sessionId: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  soreness: z.number().int().min(1).max(5).nullable().optional(),
  visibility: z.enum(["public", "followers", "private"]).optional(),
});

export const finishSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => finishSchema.parse(input))
  .handler(async ({ context, data }) =>
    withTransaction(async (sql: Sql) => {
      const rows =
        await sql<SessionRow>`select * from forge_finish_session(${context.userId}, ${data.sessionId}, ${JSON.stringify(data)}::jsonb)`;
      await awardSession(sql, context.userId, data.sessionId);
      return mapSession(rows[0]!, await setsFor(data.sessionId, context.userId, sql));
    }),
  );

const photoSchema = z.object({
  sessionId: z.number().int().positive(),
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
  .validator((id: unknown) => z.number().int().positive().parse(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql.query<SessionRow>(
      `select w.* from workout_sessions w
      where w.id = $2 and ${activityVisibilitySql("w")} and (w.user_id = $1 or w.completed_at is not null)`,
      [context.userId, id],
    );
    const row = rows[0];
    if (!row) return null;
    if (!row.completed_at && row.user_id !== context.userId) return null;
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
    return Promise.all(rows.map(async (r) => mapSession(r, await setsFor(r.id, context.userId))));
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
      achievedAt: new Date(r.achieved_at).toISOString(),
    }));
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => z.number().int().positive().parse(id))
  .handler(async ({ context, data: id }) =>
    withTransaction(async (sql: Sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + context.userId}, 0))`;
      const deleted = await sql<{ id: number }>`delete from workout_sessions
      where id = ${id} and user_id = ${context.userId} returning id`;
      if (!deleted.length) throw new Error("Session not found");
      return { id };
    }),
  );
