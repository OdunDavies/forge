import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { activityVisibilitySql } from "./activity-visibility.ts";

test("shared activity predicate denies private and unknown visibility even for followers", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table workout_sessions(id int, user_id text, visibility text);
      create table follows(follower_id text, following_id text);
      insert into workout_sessions values
        (1,'owner','public'),(2,'owner','followers'),(3,'owner','private'),(4,'owner','unknown');
      insert into follows values ('follower','owner');`);
    for (const [viewer, expected] of [
      ["owner", [1, 2, 3, 4]],
      ["follower", [1, 2]],
      ["stranger", [1]],
    ] as const) {
      const result = await db.query<{ id: number }>(
        `select s.id from workout_sessions s
        where ${activityVisibilitySql()} order by s.id`,
        [viewer],
      );
      assert.deepEqual(
        result.rows.map((row) => row.id),
        expected,
      );
    }
    const following = await db.query<{ id: number }>(
      `select s.id from workout_sessions s
      where ${activityVisibilitySql()} and (s.user_id = $1 or s.user_id in
        (select following_id from follows where follower_id = $1)) order by s.id`,
      ["follower"],
    );
    assert.deepEqual(
      following.rows.map((row) => row.id),
      [1, 2],
    );
  } finally {
    await db.close();
  }
});
