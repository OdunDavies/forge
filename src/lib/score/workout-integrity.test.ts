import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { loadScoreData } from "./data.server.ts";
import { awardSession, loadProgression } from "../gamification/progression.server.ts";
import type { Sql } from "../db.server.ts";

function client(query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>): Sql {
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    values.forEach((_, i) => {
      text += `$${i + 1}${strings[i + 1]}`;
    });
    return (await query<T>(text, values)).rows;
  }) as Sql;
  sql.query = async <T>(text: string, params?: unknown[]) => (await query<T>(text, params)).rows;
  return sql;
}

test("workout integrity and rewards use an isolated database", async (t) => {
  const db = new PGlite();
  const sql = client((text, params) => db.query(text, params));
  t.after(() => db.close());
  for (const name of [
    "0002_gymify.sql",
    "0003_forge.sql",
    "0007_progression.sql",
    "0009_workout_integrity.sql",
  ]) {
    await db.exec(await readFile(new URL(`../../../migrations/${name}`, import.meta.url), "utf8"));
  }
  async function workout(owner = "owner") {
    const result = await db.query<{ id: number }>(
      "insert into workout_sessions(user_id,title) values($1,'Test') returning id",
      [owner],
    );
    return result.rows[0].id;
  }
  async function add(id: number, weight = 50, warmup = false, done = false, name = "Bench Press") {
    const result = await db.query<{ id: number }>(
      "insert into session_sets(session_id,user_id,exercise_name,set_index,weight_kg,reps,completed,is_warmup) values($1,'owner',$2,1,$3,5,$4,$5) returning id",
      [id, name, weight, done, warmup],
    );
    return result.rows[0].id;
  }
  async function log(id: number, weight: number, done = true, warmup: boolean | null = null) {
    await db.query("select forge_log_set('owner',$1,$2,5,null,$3,$4)", [id, weight, done, warmup]);
  }
  async function finish(id: number) {
    const result = await db.query<{
      completed_at: Date;
      set_count: number;
      pr_count: number;
      volume_kg: string;
      duration_sec: number;
    }>("select * from forge_finish_session('owner',$1,'{}')", [id]);
    return result.rows[0];
  }
  async function award(id: number) {
    const result = await db.query<{
      reward: { xp: number; pr_xp: number; newly_awarded: boolean };
    }>("select forge_award_session('owner',$1,0) as reward", [id]);
    return result.rows[0].reward;
  }

  const id = await workout();
  const pending = await add(id);
  await assert.rejects(finish(id), /working set/);
  await assert.rejects(award(id), /Completed session/);
  const warmup = await add(id, 500, true, true);
  await assert.rejects(finish(id), /working set/);
  const working = await add(id, 50);
  await log(working, 50);
  const finished = await finish(id);
  assert.equal(finished.set_count, 1);
  assert.equal(finished.pr_count, 1);
  assert.equal(Number(finished.volume_kg), 250);
  const repeated = await finish(id);
  assert.equal(repeated.completed_at.getTime(), finished.completed_at.getTime());
  assert.equal(repeated.duration_sec, finished.duration_sec);
  const sets = await db.query<{ id: number; completed: boolean; is_pr: boolean }>(
    "select id,completed,is_pr from session_sets where session_id=$1",
    [id],
  );
  assert.equal(sets.rows.find((s) => s.id === pending)?.completed, false);
  assert.equal(sets.rows.find((s) => s.id === warmup)?.is_pr, false);
  const earned = await award(id);
  assert.equal(earned.xp, 75);
  assert.equal(earned.newly_awarded, true);
  assert.deepEqual(await award(id), { ...earned, newly_awarded: false });
  await assert.rejects(
    db.query("select forge_award_session('intruder',$1,0)", [id]),
    /Completed session/,
  );
  await assert.rejects(
    db.query("select forge_finish_session('intruder',$1,'{}')", [id]),
    /Session not found/,
  );
  await log(working, 50, true, true);
  assert.equal(
    (await db.query("select * from personal_records where source_set_id=$1", [working])).rows
      .length,
    0,
  );
  assert.equal((await finish(id)).set_count, 0);
  await log(working, 50, true, false);
  assert.equal((await finish(id)).set_count, 1);

  const secondId = await workout();
  const second = await add(secondId, 60);
  await log(second, 60);
  await finish(secondId);
  await log(second, 40);
  let records = await db.query<{ weight_kg: string; source_set_id: number }>(
    "select weight_kg,source_set_id from personal_records where user_id='owner'",
  );
  assert.equal(records.rows.length, 1);
  assert.equal(records.rows[0].source_set_id, working);
  assert.equal(Number(records.rows[0].weight_kg), 50);
  await log(working, 50, false);
  records = await db.query("select source_set_id from personal_records where user_id='owner'");
  assert.deepEqual(
    records.rows.map((row) => row.source_set_id),
    [second],
  );
  const summary = await db.query<{ set_count: number; pr_count: number; volume_kg: string }>(
    "select set_count,pr_count,volume_kg from workout_sessions where id=$1",
    [id],
  );
  assert.equal(summary.rows[0].set_count, 0);
  assert.equal(summary.rows[0].pr_count, 0);
  assert.equal(Number(summary.rows[0].volume_kg), 0);
  assert.deepEqual(await award(id), { ...earned, newly_awarded: false });
  await db.query("select forge_remove_set('owner',$1,$2)", [secondId, second]);
  records = await db.query("select source_set_id from personal_records where user_id='owner'");
  assert.equal(records.rows.length, 0);

  // Source mutation and its derived records/summaries roll back together.
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.query("select forge_log_set('owner',$1,100,5,null,true,false)", [working]);
      throw new Error("abort");
    }),
    /abort/,
  );
  const rolledBack = await db.query<{ completed: boolean }>(
    "select completed from session_sets where id=$1",
    [working],
  );
  assert.equal(rolledBack.rows[0].completed, false);
  assert.equal((await db.query("select * from personal_records")).rows.length, 0);

  const caps: number[] = [earned.pr_xp];
  for (let i = 0; i < 5; i++) {
    const next = await workout();
    await add(next, 100 + i * 10, false, true, "Deadlift");
    await finish(next);
    caps.push((await award(next)).pr_xp);
  }
  assert.equal(
    caps.reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.equal(caps[caps.length - 1], 0);

  const endId = await workout();
  const suggestion = await add(endId);
  await assert.rejects(
    db.query("select forge_complete_exercise('owner',$1,'Bench Press')", [endId]),
    /Log a working set/,
  );
  await log(suggestion, 50);
  const extra = await add(endId, 1000);
  await db.query("select forge_complete_exercise('owner',$1,'Bench Press')", [endId]);
  assert.equal((await db.query("select id from session_sets where id=$1", [extra])).rows.length, 0);
  await assert.rejects(
    db.query("select forge_log_set('intruder',$1,100,5,null,true,false)", [suggestion]),
    /Set not found/,
  );
  await assert.rejects(
    db.query("select forge_remove_set('intruder',$1,$2)", [endId, suggestion]),
    /Set not found/,
  );
  await db.query("delete from workout_sessions where id=$1", [endId]);
  assert.equal(
    (await db.query("select * from personal_records where session_id=$1", [endId])).rows.length,
    0,
  );

  await t.test(
    "persisted score data has camel-case sets, actual history and owner isolation",
    async () => {
      const data = await loadScoreData(sql, "owner");
      assert.ok(data.sessions.length > 0);
      assert.equal(typeof data.sessions[0].id, "number");
      assert.equal(typeof data.sessions[0].completedAt, "string");
      const original = data.sessions.find((s) => s.id === id)!;
      assert.ok(original.sets.some((s) => s.id === pending && !s.completed));
      assert.ok(original.sets.some((s) => s.id === warmup && s.isWarmup));
      assert.deepEqual((await loadScoreData(sql, "intruder")).sessions, []);
    },
  );

  await t.test(
    "progression reads do not write or award, rewards and badges persist across retries",
    async () => {
      await db.query(
        "insert into profiles(user_id,handle,display_name,sex,focus_muscles) values('owner','owner','Owner','other','{chest}')",
      );
      await db.query(
        "insert into exercises(id,name,primary_muscles) values('bench','Bench Press','{chest}')",
      );
      const rewardId = await workout();
      const rewardSet = await add(rewardId, 75, false, true);
      await db.query("update session_sets set exercise_id='bench' where id=$1", [rewardSet]);
      await finish(rewardId);
      const before = await db.query("select * from session_rewards order by session_id");
      const firstRead = await loadProgression(sql, "owner");
      assert.deepEqual(await loadProgression(sql, "owner"), firstRead);
      assert.deepEqual(
        (await db.query("select * from session_rewards order by session_id")).rows,
        before.rows,
      );
      assert.equal((await db.query("select * from earned_badges")).rows.length, 0);
      const result = await db.transaction((tx) =>
        awardSession(
          client((text, params) => tx.query(text, params)),
          "owner",
          rewardId,
        ),
      );
      assert.ok(result.rewards.xpGained >= 100);
      assert.equal(result.progression.xp, firstRead.xp + result.rewards.xpGained);
      assert.equal(result.progression.rank.name, "Iron");
      assert.equal(result.rewards.rankUp, firstRead.rank.xpFloor < result.progression.rank.xpFloor);
      assert.ok(result.rewards.badges.some((badge) => badge.badgeId === "firstSession"));
      assert.equal(
        result.progression.badges.find((badge) => badge.badgeId === "firstShare")?.earned,
        false,
      );
      const repeatedReward = await db.transaction((tx) =>
        awardSession(
          client((text, params) => tx.query(text, params)),
          "owner",
          rewardId,
        ),
      );
      assert.equal(repeatedReward.rewards.xpGained, 0);
      assert.equal(repeatedReward.rewards.rankUp, false);
      assert.deepEqual(repeatedReward.rewards.badges, []);
      assert.equal(repeatedReward.progression.xp, result.progression.xp);
      await assert.rejects(
        db.transaction((tx) =>
          awardSession(
            client((text, params) => tx.query(text, params)),
            "intruder",
            rewardId,
          ),
        ),
        /Completed session/,
      );
      await log(rewardSet, 75, false);
      assert.equal(
        (await loadProgression(sql, "owner")).badges.find(
          (badge) => badge.badgeId === "firstSession",
        )?.earned,
        true,
      );
    },
  );
});
