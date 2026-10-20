import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { bodyComparisonSchema, comparePhotosSchema, parseGoalPhoto } from "./body-goal.ts";
import { comparePhysiquePhotos } from "./ai/grok.ts";
import { loadPlanGoalContext } from "./plan/goal-context.server.ts";
import type { Sql } from "./db.server.ts";

const analysis = {
  summary: "Emphasize shoulder and back training within a balanced program.",
  focusMuscles: ["shoulders", "back"],
  trainingNotes: ["Progress gradually with controlled rows and presses."],
  limitations: "Photos cannot predict a matching body shape or timeline.",
  trainingGoal: "hypertrophy",
};

test("photo validation rejects wrong types, disguised files, oversized content and incomplete pairs", () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 224]).toString("base64")}`;
  assert.equal(parseGoalPhoto(jpeg).mimeType, "image/jpeg");
  assert.throws(() => parseGoalPhoto(jpeg.replace("image/jpeg", "image/png")), /valid JPEG/);
  assert.throws(() => parseGoalPhoto("data:image/jpeg;base64,SGVsbG8="), /valid JPEG/);
  assert.throws(() => parseGoalPhoto("data:image/svg+xml;base64,AAAA"), /valid JPEG/);
  assert.throws(() => parseGoalPhoto(`data:image/jpeg;base64,${Buffer.alloc(1_000_001, 255).toString("base64")}`), /under 1 MB/);
  assert.equal(comparePhotosSchema.safeParse({ currentImage: jpeg }).success, false);
  assert.equal(bodyComparisonSchema.safeParse({ ...analysis, focusMuscles: [] }).success, false);
  assert.equal(bodyComparisonSchema.safeParse({ ...analysis, trainingGoal: "rapid-weight-loss" }).success, false);
  assert.deepEqual(bodyComparisonSchema.parse({ ...analysis, focusMuscles: ["back", "back"] }).focusMuscles, ["back"]);
});

test("comparison sends two separately labeled photos and handles unavailable analysis", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(String(options?.body));
      const parts = request.contents[0].parts;
      assert.match(parts[1].text, /current physique/);
      assert.deepEqual(parts[2].inlineData, { mimeType: "image/jpeg", data: "current-bytes" });
      assert.match(parts[3].text, /dream physique/);
      assert.deepEqual(parts[4].inlineData, { mimeType: "image/png", data: "goal-bytes" });
      assert.match(request.systemInstruction.parts[0].text, /Never promise an exact body match/);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] });
    };
    const result = await comparePhysiquePhotos({ mimeType: "image/jpeg", data: "current-bytes" }, { mimeType: "image/png", data: "goal-bytes" }, "beginner, two days per week");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(bodyComparisonSchema.parse(JSON.parse(result.text)), analysis);
    globalThis.fetch = async () => new Response(null, { status: 429 });
    const busy = await comparePhysiquePhotos({ mimeType: "image/jpeg", data: "a" }, { mimeType: "image/jpeg", data: "b" }, "");
    assert.deepEqual(busy, { ok: false, error: "Photo analysis is busy. Try again shortly." });
    delete process.env.GEMINI_API_KEY;
    assert.equal((await comparePhysiquePhotos({ mimeType: "image/jpeg", data: "a" }, { mimeType: "image/jpeg", data: "b" }, "")).ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("comparison migration is repeatable and plan context only loads the owner's saved guidance", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../../migrations/0010_goal_scans.sql", import.meta.url), "utf8"));
    const migration = await readFile(new URL("../../migrations/0011_body_goal_comparisons.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const inserted = await db.query<{ id: number }>(`insert into goal_scans (user_id, summary, focus_muscles, training_notes, limitations, scan_kind, training_goal) values ($1,$2,$3,$4,$5,'comparison',$6) returning id`, ["athlete-a", analysis.summary, analysis.focusMuscles, analysis.trainingNotes, analysis.limitations, analysis.trainingGoal]);
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((result, part, i) => result + part + (i < values.length ? `$${i + 1}` : ""), "");
      return (await db.query(text, values)).rows;
    }) as Sql;
    const id = inserted.rows[0].id;
    assert.deepEqual(await loadPlanGoalContext(sql, "athlete-a", id), analysis);
    await assert.rejects(loadPlanGoalContext(sql, "athlete-b", id), /no longer available/);
    assert.equal(await loadPlanGoalContext(sql, "athlete-a"), null);
    const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'goal_scans'");
    assert.equal(columns.rows.some((column) => /image|photo/.test(column.column_name)), false);
  } finally { await db.close(); }
});
