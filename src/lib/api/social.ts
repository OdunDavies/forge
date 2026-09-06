import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num0 } from "@/lib/db-map";

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
  const sets = await sql<{
    session_id: number;
    exercise_name: string;
    weight_kg: unknown;
    reps: number | null;
    is_pr: boolean;
  }>`select session_id, exercise_name, weight_kg, reps, is_pr from session_sets
     where completed = true and is_warmup = false`;
  const bySession = new Map<number, FeedItem["topSets"]>();
  for (const s of sets) {
    if (!ids.includes(s.session_id)) continue;
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

export const getFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((scope: "following" | "global" = "following") => scope)
  .handler(async ({ context, data: scope }) => {
    const sql = await getSql();
    const filter =
      scope === "global"
        ? `s.visibility = 'public'`
        : `(s.user_id = $1 or s.user_id in (select following_id from follows where follower_id = $1))`;
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
       limit 40`,
      [context.userId],
    );
    return hydrate(rows);
  });

export const toggleKudos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((activityId: number) => activityId)
  .handler(async ({ context, data: activityId }) => {
    const sql = await getSql();
    const existing = await sql<{ user_id: string }>`
      select user_id from activity_kudos where activity_id = ${activityId} and user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`delete from activity_kudos where activity_id = ${activityId} and user_id = ${context.userId}`;
      return { kudoed: false };
    }
    await sql`insert into activity_kudos (activity_id, user_id) values (${activityId}, ${context.userId})`;
    return { kudoed: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ activityId: z.number(), body: z.string().min(1).max(280) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`insert into activity_comments (activity_id, user_id, body)
              values (${data.activityId}, ${context.userId}, ${data.body})`;
    return { ok: true };
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((activityId: number) => activityId)
  .handler(async ({ data: activityId }) => {
    const sql = await getSql();
    return sql<{
      id: number;
      body: string;
      created_at: string;
      handle: string;
      display_name: string;
      user_id: string;
    }>`select c.id, c.body, c.created_at, c.user_id, p.handle, p.display_name
       from activity_comments c
       join profiles p on p.user_id = c.user_id
       where c.activity_id = ${activityId}
       order by c.created_at`;
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
       where s.user_id = $2 and s.completed_at is not null and s.visibility = 'public'
       order by s.completed_at desc
       limit 20`,
      [context.userId, userId],
    );
    return hydrate(rows);
  });
