import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");
let server, db, api;
const mocks = {
  "@tanstack/react-start": `
    export const createServerOnlyFn = fn => fn;
    export function createServerFn() {
      let validate = value => value;
      return { middleware() {return this;}, validator(fn) {validate=fn; return this;},
        handler(fn) {return ({data} = {}) => fn({data:validate(data),context:{userId:globalThis.profileTestUser}});} };
    }
  `,
  "@/lib/auth/middleware": `export const authMiddleware = {};`,
  "@/lib/db.server": `export const getSql = async () => globalThis.profileTestSql;`,
};

describe("Profile API persistence regressions", { concurrency: false }, () => {
  before(async () => {
    // Fresh in-memory PostgreSQL instance, not the configured Forge database.
    db = new PGlite();
    await db.exec(`create table profiles (
      user_id text primary key, handle text unique not null, display_name text not null,
      bio text, sex text, birth_year integer, height_cm numeric, weight_kg numeric, units text,
      experience text, goal text, days_per_week integer, session_minutes integer,
      equipment text[], injuries text, available_days integer[], focus_muscles text[],
      baseline_lifts jsonb default '{}', onboarded_at timestamptz, updated_at timestamptz
    )`);
    const sql = async (strings, ...values) => {
      const text = strings.reduce(
        (text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ""),
        "",
      );
      return (await db.query(text, values)).rows;
    };
    sql.query = async (text, values) => (await db.query(text, values)).rows;
    globalThis.profileTestSql = sql;
    globalThis.profileTestUser = "account-a";
    server = await createServer({
      root,
      configFile: false,
      cacheDir: "node_modules/.vite-profile-tests",
      ssr: { noExternal: true },
      resolve: { alias: { "@": `${root}src` } },
      server: { middlewareMode: true, watch: null, hmr: false },
      plugins: [
        {
          name: "profile-api-regression-fixture",
          enforce: "pre",
          resolveId(id) {
            const key = Object.keys(mocks).find(
              (key) =>
                key === id ||
                (key.startsWith("@/") &&
                  id.replaceAll("\\", "/").replace(/\.tsx?$/, "") === `${root}src/${key.slice(2)}`),
            );
            if (key) return `\0${key}`;
          },
          load(id) {
            return mocks[id.slice(1)];
          },
        },
      ],
    });
    api = await server.environments.ssr.runner.import("/src/lib/api/profile.ts");
  });
  after(async () => {
    await server?.close();
    await db?.close();
    delete globalThis.profileTestSql;
    delete globalThis.profileTestUser;
  });

  it("binds all 19 SQL parameters and persists focus and validated baseline lifts", async () => {
    const profile = await api.upsertMyProfile({
      data: {
        displayName: "Ada",
        sex: null,
        birthYear: 1990,
        weightKg: 100,
        heightCm: 177.8,
        units: "imperial",
        focusMuscles: ["chest"],
        baseline_lifts: { squat: 100, bench: null },
        availableDays: [1, 3],
        daysPerWeek: 2,
        equipment: ["dumbbell"],
        sessionMinutes: 60,
      },
    });
    assert.equal(profile.userId, "account-a");
    assert.deepEqual(profile.focusMuscles, ["chest"]);
    assert.deepEqual(profile.baseline_lifts, { squat: 100 });
    assert.equal(profile.onboardedAt, null);
    assert.equal(profile.sex, null);
  });

  it("preserves omitted values but clears explicitly null optional fields", async () => {
    await api.upsertMyProfile({ data: { displayName: "Ada", sex: "female" } });
    const unchanged = await api.upsertMyProfile({ data: { displayName: "Ada" } });
    assert.equal(unchanged.sex, "female");
    assert.equal(unchanged.birthYear, 1990);
    assert.equal(unchanged.weightKg, 100);
    assert.deepEqual(unchanged.baseline_lifts, { squat: 100 });
    const cleared = await api.upsertMyProfile({
      data: { displayName: "Ada", sex: null, birthYear: null, heightCm: null, weightKg: null },
    });
    assert.equal(cleared.sex, null);
    assert.equal(cleared.birthYear, null);
    assert.equal(cleared.heightCm, null);
    assert.equal(cleared.weightKg, null);
    assert.deepEqual(cleared.baseline_lifts, { squat: 100 });
  });

  it("writes an explicit completion timestamp and preserves it on subsequent saves", async () => {
    const completed = await api.upsertMyProfile({
      data: { displayName: "Ada", markOnboarded: true },
    });
    assert.ok(completed.onboardedAt);
    const updated = await api.upsertMyProfile({
      data: { displayName: "Ada", markOnboarded: true, injuries: "Knee" },
    });
    assert.deepEqual(updated.onboardedAt, completed.onboardedAt);
  });

  it("rejects invalid sex and nonpositive baseline lifts before persistence", async () => {
    for (const data of [
      { sex: "invalid" },
      { baseline_lifts: { squat: -1 } },
      { baseline_lifts: { bench: Infinity } },
    ]) {
      await assert.rejects(async () =>
        api.upsertMyProfile({ data: { displayName: "Ada", ...data } }),
      );
    }
    assert.deepEqual((await api.getMyProfile()).baseline_lifts, { squat: 100 });
  });

  it("persists and loads the context account only", async () => {
    globalThis.profileTestUser = "account-b";
    assert.equal(await api.getMyProfile(), null);
    const other = await api.upsertMyProfile({ data: { displayName: "Ada", baseline_lifts: {} } });
    assert.equal(other.userId, "account-b");
    assert.equal(other.onboardedAt, null);
    assert.notEqual(other.handle, (await api.loadProfileByUserId("account-a")).handle);
    assert.deepEqual(other.baseline_lifts, {});
    globalThis.profileTestUser = "account-a";
    assert.deepEqual((await api.getMyProfile()).baseline_lifts, { squat: 100 });
  });
});
