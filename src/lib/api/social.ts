import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db.server";
import { num0 } from "@/lib/db-map";
import { activityVisibilitySql } from "./activity-visibility";

export type FeedItem = {
  id: number;
  userId: string;
  handle: string;
  displayName: string;
  title: string;
  completedAt: string;
  durationSec: number | null;
  volumeKg: number;
  setCount: number;
  prCount: number;
  notes: string;
  kudos: number;
  comments: number;
  iKudoed: boolean;
  photoUrl: string | null;
  topSets: { exerciseName: string; weightKg: number | null; reps: number | null; isPr: boolean }[];
};

type FeedRow = {
  id: number;
  user_id: string;
  handle: string;
  display_name: string;
  title: string;
  completed_at: string;
  duration_sec: number | null;
  volume_kg: unknown;
  set_count: number;
  pr_count: number;
  notes: string;
  kudos: number;
  comments: number;
  i_kudoed: boolean;
  photo_url: string | null;
};

function truthy(v: unknown) {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

async function hydrate(rows: FeedRow[]): Promise<FeedItem[]> {
  if (!rows.length) return [];
  const sql = await getSql();
  const ids = rows.map((r) => r.id);
  const sets = await sql.query<{
    session_id: number;
    exercise_name: string;
    weight_kg: unknown;
    reps: number | null;
    is_pr: boolean;
  }>(
    `select session_id, exercise_name, weight_kg, reps, is_pr from session_sets
     where session_id = any($1::int[]) and completed = true and is_warmup = false
     order by id`,
    [ids],
  );
  const bySession = new Map<number, FeedItem["topSets"]>();
  for (const s of sets) {
    const list = bySession.get(s.session_id) ?? [];
    if (list.length >= 3) continue;
    list.push({
      exerciseName: s.exercise_name,
      weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
      reps: s.reps,
      isPr: Boolean(s.is_pr),
    });
    bySession.set(s.session_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    title: r.title,
    completedAt: r.completed_at,
    durationSec: r.duration_sec,
    volumeKg: num0(r.volume_kg),
    setCount: r.set_count,
    prCount: r.pr_count,
    notes: r.notes,
    kudos: r.kudos,
    comments: r.comments,
    iKudoed: truthy(r.i_kudoed),
    photoUrl: r.photo_url,
    topSets: bySession.get(r.id) ?? [],
  }));
}

const feedInputSchema = z.object({
  scope: z.enum(["following", "global"]).default("following"),
  offset: z.number().int().min(0).max(100000).optional().default(0),
});
export const getFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (typeof input === "string") return feedInputSchema.parse({ scope: input, offset: 0 });
    if (input == null) return feedInputSchema.parse({ scope: "following", offset: 0 });
    return feedInputSchema.parse(input);
  })
  .handler(async ({ context, data }) => {
    const { scope, offset } = data as { scope: "following" | "global"; offset: number };
    const sql = await getSql();
    const filter =
      scope === "global"
        ? `s.visibility = 'public'`
        : `(${activityVisibilitySql()}) and (s.user_id = $1 or s.user_id in (select following_id from follows where follower_id = $1))`;
    const limit = 20;
    const safeOffset = Math.max(0, Math.floor(offset));
    const rows = await sql.query<FeedRow>(
      `select s.id, s.user_id, p.handle, p.display_name, s.title, s.completed_at, s.duration_sec,
              s.volume_kg, s.set_count, s.pr_count, s.notes, s.photo_url,
              (select count(*)::int from activity_kudos k where k.activity_id = s.id) as kudos,
              (select count(*)::int from activity_comments c where c.activity_id = s.id) as comments,
              exists(select 1 from activity_kudos k where k.activity_id = s.id and k.user_id = $1) as i_kudoed
       from workout_sessions s
       join profiles p on p.user_id = s.user_id
       where s.completed_at is not null and ${filter}
       order by s.completed_at desc
       limit ${limit} offset ${safeOffset}`,
      [context.userId],
    );
    return hydrate(rows);
  });

async function assertActivityVisible(activityId: number, userId: string) {
  const sql = await getSql();
  const rows = await sql<{id:number}>`select s.id from workout_sessions s
    where s.id = ${activityId} and s.completed_at is not null and
    (s.user_id = ${userId} or s.visibility = 'public' or (s.visibility = 'followers' and
      exists(select 1 from follows f where f.follower_id = ${userId} and f.following_id = s.user_id)))`;
  if (!rows.length) throw new Error("Activity not found");
}

export const toggleKudos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((activityId: unknown) => z.number().int().positive().parse(activityId))
  .handler(async ({ context, data: activityId }) => {
    await assertActivityVisible(activityId, context.userId);
    const sql = await getSql();
    const removed = await sql.query(
      `delete from activity_kudos k using workout_sessions s
      where k.activity_id = s.id and s.id = $2 and k.user_id = $1
      and s.completed_at is not null and ${activityVisibilitySql()} returning k.user_id`,
      [context.userId, activityId],
    );
    if (removed[0]) {
      return { kudoed: false };
    }
    const added = await sql.query(
      `insert into activity_kudos (activity_id,user_id)
      select s.id,$1 from workout_sessions s where s.id = $2
      and s.completed_at is not null and ${activityVisibilitySql()}
      on conflict do nothing returning user_id`,
      [context.userId, activityId],
    );
    if (!added[0]) throw new Error("Activity not found or already kudoed");
    return { kudoed: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({ activityId: z.number().int().positive(), body: z.string().trim().min(1).max(280) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const added = await sql.query(
      `insert into activity_comments (activity_id,user_id,body)
      select s.id,$1,$3 from workout_sessions s where s.id = $2
      and s.completed_at is not null and ${activityVisibilitySql()} returning id`,
      [context.userId, data.activityId, data.body],
    );
    if (!added[0]) throw new Error("Activity not found");
    return { ok: true };
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((activityId: unknown) => z.number().int().positive().parse(activityId))
  .handler(async ({ context, data: activityId }) => {
    const sql = await getSql();
    return sql.query<{
      id: number;
      body: string;
      created_at: string;
      handle: string;
      display_name: string;
      user_id: string;
    }>(
      `select c.id, c.body, c.created_at, c.user_id, p.handle, p.display_name
        from activity_comments c
        join workout_sessions s on s.id = c.activity_id
        join profiles p on p.user_id = c.user_id
        where c.activity_id = $2 and s.completed_at is not null and ${activityVisibilitySql()}
        order by c.created_at`,
      [context.userId, activityId],
    );
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetUserId: string) => targetUserId)
  .handler(async ({ context, data: target }) => {
    if (target === context.userId) return { following: false };
    const sql = await getSql();
    const existing = await sql<{ follower_id: string }>`
      select follower_id from follows where follower_id = ${context.userId} and following_id = ${target}`;
    if (existing[0]) {
      await sql`delete from follows where follower_id = ${context.userId} and following_id = ${target}`;
      return { following: false };
    }
    await sql`insert into follows (follower_id, following_id) values (${context.userId}, ${target})`;
    return { following: true };
  });

export const followState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((targetUserId: string) => targetUserId)
  .handler(async ({ context, data: target }) => {
    const sql = await getSql();
    const following = await sql<{ c: number }>`
      select count(*)::int as c from follows where follower_id = ${context.userId} and following_id = ${target}`;
    const followers = await sql<{ c: number }>`
      select count(*)::int as c from follows where following_id = ${target}`;
    const follows = await sql<{ c: number }>`
      select count(*)::int as c from follows where follower_id = ${target}`;
    return {
      following: (following[0]?.c ?? 0) > 0,
      followerCount: followers[0]?.c ?? 0,
      followingCount: follows[0]?.c ?? 0,
      isSelf: context.userId === target,
    };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const deleted = await sql.query(
      `delete from activity_comments c using workout_sessions s
      where c.id = $2 and c.user_id = $1 and s.id = c.activity_id
      and s.completed_at is not null and ${activityVisibilitySql()} returning c.id`,
      [context.userId, data.id],
    );
    if (!deleted[0]) throw new Error("Comment not found");
    return { ok: true };
  });

export const searchUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ q: z.string().max(60) }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const q = `%${data.q}%`;
    return sql<{ handle: string; display_name: string }>`
      select handle, display_name from profiles where handle ilike ${q} limit 10`;
  });

export const countNewKudos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const kudos = await sql<{ c: number }>`
      select count(*)::int as c from activity_kudos k
      join workout_sessions s on s.id = k.activity_id
      where s.user_id = ${context.userId} and k.user_id != ${context.userId}`;
    const comments = await sql<{ c: number }>`
      select count(*)::int as c from activity_comments c
      join workout_sessions s on s.id = c.activity_id
      where s.user_id = ${context.userId} and c.user_id != ${context.userId}`;
    return { count: (kudos[0]?.c ?? 0) + (comments[0]?.c ?? 0) };
  });

export const listUserActivities = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    const sql = await getSql();
    const rows = await sql.query<FeedRow>(
      `select s.id, s.user_id, p.handle, p.display_name, s.title, s.completed_at, s.duration_sec,
              s.volume_kg, s.set_count, s.pr_count, s.notes, s.photo_url,
              (select count(*)::int from activity_kudos k where k.activity_id = s.id) as kudos,
              (select count(*)::int from activity_comments c where c.activity_id = s.id) as comments,
              exists(select 1 from activity_kudos k where k.activity_id = s.id and k.user_id = $1) as i_kudoed
       from workout_sessions s
       join profiles p on p.user_id = s.user_id
        where s.user_id = $2 and s.completed_at is not null and ${activityVisibilitySql()}
       order by s.completed_at desc
       limit 20`,
      [context.userId, userId],
    );
    return hydrate(rows);
  });
