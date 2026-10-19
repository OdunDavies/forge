import assert from "node:assert/strict";
import { test } from "node:test";
import data from "../../data/exercises.json" with { type: "json" };
import { EXERCISE_CATALOG, buildCatalog, getExercise, searchExercises } from "./catalog.ts";
import { matchExercise, suggestExercise, exerciseFocusMuscles, validateAliases } from "./match.ts";
import { normalizeName, resolveFocusPrimary } from "./taxonomy.ts";

test("catalog adapts all checked-in old-shape records without changing IDs or media", () => {
  assert.equal(EXERCISE_CATALOG.size, data.length);
  assert.ok(data.length > 3000);
  for (const raw of data) {
    const entry = getExercise(raw.id)!;
    assert.equal(entry.id, raw.id);
    assert.equal(entry.name, raw.name);
    assert.equal(entry.imageUrl, raw.imageUrl);
    assert.equal(entry.equipment, raw.equipment);
    assert.deepEqual(entry.instructions, raw.instructions);
    assert.ok(EXERCISE_CATALOG.has(entry.canonicalId));
    if (entry.kind === "strength") assert.ok(entry.focusPrimary.length > 0);
  }
  assert.equal(getExercise("missing"), null);
  assert.ok(searchExercises("bench press").length > 0);
});

test("normalization preserves movement differences and maps muscle taxonomy without mutation", () => {
  assert.equal(normalizeName("  Push-ups (male) "), normalizeName("Pushups"));
  assert.equal(normalizeName("DB RDL"), "dumbbell romanian deadlift");
  assert.notEqual(normalizeName("Incline Dumbbell Press"), normalizeName("Dumbbell Press"));
  const first = resolveFocusPrimary("glutes", ["glutes", "quadriceps"], ["lats", "biceps"]);
  assert.deepEqual(first, { primary: ["glutes", "quads"], secondary: ["back", "arms"] });
  assert.deepEqual(resolveFocusPrimary("glutes", [], []), { primary: ["glutes"], secondary: [] });
});

test("strict matching uses actual aliases and never substitutes closest movements", () => {
  validateAliases();
  assert.equal(matchExercise("Barbell Back Squat")?.id, "Barbell_Squat");
  assert.equal(matchExercise("Barbell Bench Press")?.id, "Barbell_Bench_Press_-_Medium_Grip");
  assert.equal(matchExercise("Push-Up")?.id, "Pushups");
  assert.equal(matchExercise("RDL")?.id, "Romanian_Deadlift");
  assert.equal(matchExercise("Face Pull")?.id, "Face_Pull");
  assert.equal(matchExercise("Nordic Curl"), null);
  assert.equal(suggestExercise("Nordic Curl")?.id, "Natural_Glute_Ham_Raise");
  assert.equal(matchExercise("definitely not an exercise"), null);
  assert.equal(matchExercise(""), null);
  assert.equal(matchExercise("Push-Up", new Map()), null);
  assert.deepEqual(exerciseFocusMuscles("Bent_Over_Barbell_Row").primary, ["back"]);
  assert.ok(exerciseFocusMuscles("Bent_Over_Barbell_Row").secondary.includes("arms"));
});

test("canonical duplicates remain addressable but only canonical IDs are matched", () => {
  const raw = data.find((e) => e.id === "Pushups")!;
  const duplicate = { ...raw, id: "demo-copy", name: "Pushups (male)" };
  const catalog = buildCatalog([raw, duplicate]);
  assert.equal(catalog.get("demo-copy")?.canonicalId, "Pushups");
  assert.equal(matchExercise("Pushups (male)", catalog)?.id, "Pushups");
  assert.throws(() => buildCatalog([raw, raw]), /Duplicate exercise ID/);
  const ambiguous = buildCatalog([raw, { ...raw, id: "db-version", equipment: "dumbbell" }]);
  assert.equal(matchExercise("Pushups", ambiguous), null);
});
