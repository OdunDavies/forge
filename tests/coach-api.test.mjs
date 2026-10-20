import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");
let server, db, api;
const mocks = {
  "@tanstack/react-start": `export function createServerFn() {
    let validate = value => value;
    return {middleware(){return this}, validator(fn){validate=fn;return this},
      handler(fn){return ({data}={}) => fn({data:validate(data),context:{userId:'coach-test'}})}} }`,
  "@/lib/auth/middleware": "export const authMiddleware = {};",
  "@/lib/ai/rate-limit.server": "export const consumeAiBudget = async () => {};",
  "@/lib/db.server": `export const getSql = async () => globalThis.coachTestSql;
    export const withTransaction = fn => globalThis.coachTestTransaction(fn);`,
  "@/lib/ai/grok": `export const grokChat = async messages => {
    globalThis.coachTestPrompt = messages; return globalThis.coachTestResponse; };`,
  "@/lib/api/profile": "export const loadProfileByUserId = async () => null;",
  "@/lib/api/plan": "export const loadPlan = async () => null;",
};

function sqlFor(connection) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce(
      (text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ""),
      "",
    );
    return (await connection.query(query, values)).rows;
  };
  sql.query = async (query, values) => (await connection.query(query, values)).rows;
  return sql;
}

before(async () => {
  db = new PGlite();
  await db.exec(`create table coach_messages (id serial primary key, user_id text, role text, content text, created_at timestamptz default now());
    create table workout_sessions (id serial primary key, user_id text, title text, volume_kg numeric, pr_count int, notes text, started_at timestamptz, completed_at timestamptz);
    create table personal_records (user_id text, exercise_name text, weight_kg numeric, reps int, estimated_1rm numeric);
    create table session_sets (id serial primary key, session_id int, user_id text, exercise_name text, weight_kg numeric, reps int, completed boolean);`);
  globalThis.coachTestSql = sqlFor(db);
  globalThis.coachTestTransaction = (fn) => db.transaction((tx) => fn(sqlFor(tx)));
  server = await createServer({
    root,
    configFile: false,
    cacheDir: "node_modules/.vite-coach-tests",
    ssr: { noExternal: true },
    resolve: { alias: { "@": `${root}src` } },
    server: { middlewareMode: true, watch: null, hmr: false },
    plugins: [
      {
        name: "coach-test-fixture",
        enforce: "pre",
        resolveId(id, importer) {
          const normalized = id.replaceAll("\\", "/").replace(/\.tsx?$/, "");
          const relative =
            importer && id.startsWith(".")
              ? resolve(dirname(importer), id)
                  .replaceAll("\\", "/")
                  .replace(/\.tsx?$/, "")
              : "";
          const key = Object.keys(mocks).find(
            (key) =>
              key === id ||
              (key.startsWith("@/") &&
                (normalized === `${root}src/${key.slice(2)}` ||
                  relative === `${root}src/${key.slice(2)}`)),
          );
          if (key) return `\0${key}`;
        },
        load(id) {
          return mocks[id.slice(1)];
        },
      },
    ],
  });
  api = await server.environments.ssr.runner.import("/src/lib/api/coach.ts");
});

after(async () => {
  await server?.close();
  await db?.close();
  for (const key of [
    "coachTestSql",
    "coachTestTransaction",
    "coachTestPrompt",
    "coachTestResponse",
  ])
    delete globalThis[key];
});

test("an unavailable coach leaves no fake reply or duplicate message, and retry saves one ordered pair", async () => {
  globalThis.coachTestResponse = { ok: false, error: "provider configuration details" };
  const unavailable = await api.sendCoachMessage({
    data: { content: "  Help with my next workout  " },
  });
  assert.equal(unavailable.retryable, true);
  assert.equal("error" in unavailable, false);
  assert.deepEqual(await api.listCoachMessages(), []);
  globalThis.coachTestResponse = { ok: true, text: "Start with a lighter warm-up set." };
  const success = await api.sendCoachMessage({
    data: { content: "  Help with my next workout  " },
  });
  assert.equal(success.retryable, false);
  assert.deepEqual(globalThis.coachTestPrompt.at(-1), {
    role: "user",
    content: "Help with my next workout",
  });
  const messages = await api.listCoachMessages();
  assert.deepEqual(
    messages.map((m) => m.role),
    ["assistant", "user"],
  );
  assert.equal(messages[1].content, "Help with my next workout");
  await db.query(
    "insert into coach_messages(user_id,role,content) values ('another-user','user','private')",
  );
  assert.equal((await api.listCoachMessages()).length, 2);
  await assert.rejects(async () => api.sendCoachMessage({ data: { content: "   " } }));
});
