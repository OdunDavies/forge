import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { EXERCISE_CATALOG } from "./catalog.ts";
import { CATALOG_VERSION } from "./catalog-config.ts";
import { seedCatalog } from "./seed.ts";
import { queryLibrary, queryExercise, buildWhereClauses } from "./library-query.ts";
import { replaceGeneratedPlan, replaceDayExercises } from "../plan/persistence.ts";
import type { GeneratedPlan } from "../plan/schema.ts";

const pg = new PGlite();
function asSql(client: PGlite | Transaction): Sql {
  const query = async <T>(text: string, params: unknown[] = []): Promise<T[]> =>
    (await client.query<T>(text, params)).rows;
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    return query<T>(text, values);
  }) as Sql;
  sql.query = query;
  return sql;
}
const sql = asSql(pg);
const transaction = <T>(fn: (sql: Sql) => Promise<T>) => pg.transaction((tx) => fn(asSql(tx)));

before(async () => {
  await pg.exec(
    await readFile(new URL("../../../migrations/0002_gymify.sql", import.meta.url), "utf8"),
  );
  const migration = await readFile(
    new URL("../../../migrations/0008_exercise_catalog.sql", import.meta.url),
    "utf8",
  );
  await pg.exec(migration);
  await pg.exec(migration);
  await transaction((tx) => seedCatalog(tx));
  await sql`insert into profiles (user_id, handle, display_name) values ('athlete', 'athlete', 'Athlete')`;
});
after(async () => {
  await pg.close();
});

test("real migration supports text-array GIN indexes and full old-shape seed is idempotent", async () => {
  const rows = await sql<{ c: number }>`select count(*)::int as c from exercises`;
  assert.equal(rows[0].c, EXERCISE_CATALOG.size);
  const meta = await sql<{
    value: string;
  }>`select value from catalog_meta where key = 'catalog_version'`;
  assert.equal(meta[0].value, CATALOG_VERSION);
  const entry = await queryExercise(sql, "Pushups");
  assert.deepEqual(entry?.instructions, EXERCISE_CATALOG.get("Pushups")!.instructions);
  assert.equal(entry?.equipment, "body only");
  const session = await sql<{ id: number }>`insert into workout_sessions (user_id, title)
    values ('athlete', 'Saved session') returning id`;
  await sql`insert into session_sets (session_id, user_id, exercise_id, exercise_name, set_index)
    values (${session[0].id}, 'athlete', 'Pushups', 'My saved name', 0)`;
  await sql`insert into personal_records (user_id, exercise_id, exercise_name, weight_kg, reps)
    values ('athlete', 'Pushups', 'My saved name', 20, 8)`;
  await transaction((tx) => seedCatalog(tx, true));
  assert.equal(
    (await sql<{ c: number }>`select count(*)::int as c from exercises`)[0].c,
    rows[0].c,
  );
  const history = await sql<{ exercise_id: string; exercise_name: string }>`
    select exercise_id, exercise_name from session_sets where session_id = ${session[0].id}`;
  assert.deepEqual(history, [{ exercise_id: "Pushups", exercise_name: "My saved name" }]);
  const records = await sql<{ exercise_id: string; exercise_name: string }>`
    select exercise_id, exercise_name from personal_records where user_id = 'athlete'`;
  assert.deepEqual(records, history);
  const aliases = await sql<{
    exercise_id: string;
  }>`select exercise_id from exercise_aliases where alias_key = 'barbell back squat'`;
  assert.equal(aliases[0].exercise_id, "Barbell_Squat");
});

test("library executes filters together with valid placeholders, array overlap, counts and pagination", async () => {
  const filters = {
    q: "bench press",
    muscle: "chest",
    equipment: "barbell,dumbbell",
    category: "strength",
    kind: "strength" as const,
  };
  const { where, params } = buildWhereClauses(filters);
  assert.equal(
    Math.max(...[...where.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
    params.length,
  );
  const all = await queryLibrary(sql, { ...filters, limit: 100 });
  assert.ok(all.total > 3);
  assert.ok(all.items.length > 3);
  assert.ok(
    all.items.every(
      (ex) =>
        ex.name.toLowerCase().includes("bench") &&
        ex.name.toLowerCase().includes("press") &&
        ["barbell", "dumbbell"].includes(ex.equipment ?? "") &&
        ex.category === "strength",
    ),
  );
  const page = await queryLibrary(sql, { ...filters, limit: 2, offset: 1 });
  assert.equal(page.total, all.total);
  assert.deepEqual(page.items, all.items.slice(1, 3));
  assert.equal((await queryLibrary(sql, { ...filters, category: "cardio" })).total, 0);
  assert.equal((await queryLibrary(sql, { q: "' or true --" })).total, 0);
  assert.equal((await queryLibrary(sql, { q: "%" })).total, 0);
  assert.ok((await queryLibrary(sql, { muscle: "biceps" })).total > 0);
  assert.ok((await queryLibrary(sql, { muscle: "arms" })).total > 0);
  assert.ok((await queryLibrary(sql, { q: "push-ups", equipment: "body only" })).total > 0);
  assert.ok(
    (await queryLibrary(sql, { equipment: "kettlebells" })).items.every(
      (e) => e.equipment === "kettlebells",
    ),
  );
  assert.equal(await queryExercise(sql, "nonexistent"), null);
});

const generated: GeneratedPlan = {
  title: "Starter",
  split: "Full Body",
  days: [
    {
      weekday: 1,
      title: "Full Body A",
      exercises: [
        { exerciseId: "Pushups", name: "Pushups", sets: 3, reps: "8", restSec: 0 },
        { name: "Plank", sets: 2, reps: "30 sec" },
      ],
    },
  ],
};

test("failed plan replacement rolls back deactivation and every partial insert", async () => {
  const planId = await transaction((tx) => replaceGeneratedPlan(tx, "athlete", generated));
  const invalid = {
    ...generated,
    title: "Broken",
    days: [
      {
        ...generated.days[0],
        exercises: [
          generated.days[0].exercises![0],
          { exerciseId: "invalid", name: "Broken", sets: 3, reps: "8" },
        ],
      },
    ],
  };
  await assert.rejects(
    transaction((tx) => replaceGeneratedPlan(tx, "athlete", invalid)),
    /Invalid catalog exercise/,
  );
  const active = await sql<{
    id: number;
  }>`select id from workout_plans where user_id = 'athlete' and is_active`;
  assert.deepEqual(active, [{ id: planId }]);
  assert.equal(
    (
      await sql<{
        c: number;
      }>`select count(*)::int as c from workout_plans where user_id = 'athlete'`
    )[0].c,
    1,
  );
  const days = await sql<{
    c: number;
  }>`select count(*)::int as c from plan_days where plan_id = ${planId}`;
  assert.equal(days[0].c, 7);
  const exercise = await sql<{
    exercise_id: string;
    rest_sec: number;
  }>`select exercise_id, rest_sec from plan_exercises
    where user_id = 'athlete' order by sort_order limit 1`;
  assert.deepEqual(exercise[0], { exercise_id: "Pushups", rest_sec: 0 });
});

test("failed day tweak restores old exercises and notes; ownership, rest and stale days are rejected", async () => {
  const day = (
    await sql<{ id: number }>`select id from plan_days where user_id = 'athlete' and day_index = 1`
  )[0];
  await assert.rejects(
    transaction((tx) =>
      replaceDayExercises(tx, "athlete", day.id, {
        message: "Changed",
        exercises: [
          { name: "RDL", sets: 3, reps: "8" },
          { exerciseId: "invalid", name: "Broken", sets: 3, reps: "8" },
        ],
      }),
    ),
    /Invalid catalog exercise/,
  );
  assert.deepEqual(
    (
      await sql<{ exercise_id: string }>`select exercise_id from plan_exercises
    where plan_day_id = ${day.id} order by sort_order`
    ).map((e) => e.exercise_id),
    ["Pushups", "Plank"],
  );
  assert.equal(
    (await sql<{ coach_notes: string }>`select coach_notes from plan_days where id = ${day.id}`)[0]
      .coach_notes,
    "",
  );
  await assert.rejects(
    transaction((tx) =>
      replaceDayExercises(tx, "other-user", day.id, {
        exercises: [{ name: "RDL", sets: 3, reps: "8" }],
      }),
    ),
    /no longer active/,
  );
  const rest = (
    await sql<{ id: number }>`select id from plan_days where user_id = 'athlete' and day_index = 0`
  )[0];
  await assert.rejects(
    transaction((tx) =>
      replaceDayExercises(tx, "athlete", rest.id, {
        exercises: [{ name: "RDL", sets: 3, reps: "8" }],
      }),
    ),
    /no longer active/,
  );
  await transaction((tx) =>
    replaceDayExercises(tx, "athlete", day.id, {
      message: "Go easy",
      exercises: [{ name: "RDL", sets: 2, reps: "8" }],
    }),
  );
  assert.equal(
    (
      await sql<{
        exercise_id: string;
      }>`select exercise_id from plan_exercises where plan_day_id = ${day.id}`
    )[0].exercise_id,
    "Romanian_Deadlift",
  );
  await transaction((tx) => replaceGeneratedPlan(tx, "athlete", generated));
  await assert.rejects(
    transaction((tx) =>
      replaceDayExercises(tx, "athlete", day.id, {
        exercises: [{ name: "RDL", sets: 3, reps: "8" }],
      }),
    ),
    /no longer active/,
  );
  assert.equal(
    (
      await sql<{
        c: number;
      }>`select count(*)::int as c from workout_plans where user_id = 'athlete' and is_active`
    )[0].c,
    1,
  );
});
