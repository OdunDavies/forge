import assert from "node:assert/strict";
import { test } from "node:test";
import { EXERCISE_CATALOG, equipmentGroup } from "../exercises/catalog.ts";
import {
  buildFallbackPlan,
  determineSplit,
  FALLBACK_BANK,
  isUnsafe,
  volumeBreakdown,
  type FallbackProfile,
} from "./fallback.ts";
import { generatedSchema, confirmTweakSchema } from "./schema.ts";

const profile: FallbackProfile = {
  daysPerWeek: 3,
  availableDays: [1, 3, 5],
  equipment: ["full gym"],
  experience: "intermediate",
  goal: "strength",
  focusMuscles: ["chest"],
  sessionMinutes: 60,
  injuries: "",
};

test("split contract remains usable by onboarding", () => {
  assert.equal(determineSplit(3, "intermediate", ["chest"], "strength"), "Full Body");
  assert.equal(determineSplit(4, "intermediate"), "Upper / Lower");
  assert.equal(determineSplit(6, "advanced"), "Push / Pull / Legs");
  assert.equal(determineSplit(5, "beginner"), "Full Body");
});

test("real fallback bank and seven-day plans have valid original catalog IDs", () => {
  assert.ok(FALLBACK_BANK.chest.gym.length > 0);
  assert.ok(FALLBACK_BANK.chest.db.length > 0);
  assert.ok(FALLBACK_BANK.chest.body.length > 0);
  for (const equipment of [
    ["full gym"],
    ["dumbbell"],
    ["kettlebells"],
    ["barbell"],
    ["bands"],
    ["body only"],
  ]) {
    const plan = buildFallbackPlan({ ...profile, equipment });
    assert.equal(plan.days.length, 7);
    assert.deepEqual(plan, buildFallbackPlan({ ...profile, equipment }));
    assert.deepEqual(
      plan.days.filter((d) => !d.isRest).map((d) => d.weekday),
      profile.availableDays,
    );
    for (const day of plan.days) {
      if (day.isRest) {
        assert.equal(day.exercises.length, 0);
        continue;
      }
      assert.ok(day.exercises.length >= 4 && day.exercises.length <= 6);
      assert.equal(new Set(day.exercises.map((e) => e.exerciseId)).size, day.exercises.length);
      for (const slot of day.exercises) {
        const ex = EXERCISE_CATALOG.get(slot.exerciseId)!;
        assert.equal(slot.name, ex.name);
        assert.equal(ex.kind, "strength");
        assert.equal(ex.canonicalId, ex.id);
        assert.equal(ex.advanced, false);
        assert.ok(
          equipment.includes("full gym") ||
            ex.equipmentGroup.every(
              (g) => g === "body only" || equipment.map(equipmentGroup).includes(g),
            ),
        );
      }
    }
    generatedSchema.parse({ ...plan, days: plan.days.map((d) => ({ ...d, notes: d.coachNotes })) });
  }
});

test("availability is deduplicated, capped, and unselected days remain rest", () => {
  const plan = buildFallbackPlan({
    ...profile,
    daysPerWeek: 2,
    availableDays: [5, 1, 1, 8, -1, 3],
  });
  assert.deepEqual(
    plan.days.filter((d) => !d.isRest).map((d) => d.weekday),
    [1, 3],
  );
  assert.ok(buildFallbackPlan({ ...profile, availableDays: [] }).days.every((d) => d.isRest));
});

test("fallback gives roughly 40/60 focus volume while keeping lower days lower", () => {
  for (const daysPerWeek of [3, 4, 6]) {
    const plan = buildFallbackPlan({ ...profile, daysPerWeek, availableDays: [0, 1, 2, 3, 4, 5] });
    const volume = volumeBreakdown(
      plan.days.flatMap((d) => d.exercises),
      profile.focusMuscles,
    );
    assert.ok(volume.ratio >= 0.3 && volume.ratio <= 0.5, JSON.stringify(volume));
    for (const day of plan.days.filter((d) => d.title.startsWith("Lower") || d.title === "Legs")) {
      assert.ok(
        day.exercises.every((slot) =>
          EXERCISE_CATALOG.get(slot.exerciseId)!.focusPrimary.every((m) =>
            ["quads", "hamstrings", "glutes", "calves", "core"].includes(m),
          ),
        ),
      );
    }
  }
});

test("unknown exercise volume is counted once and never invents focus activation", () => {
  assert.deepEqual(
    volumeBreakdown(
      [
        { name: "RDL", sets: 3 },
        { name: "hamstrings custom unknown", sets: 2 },
      ],
      ["hamstrings"],
    ),
    { totalSets: 5, focusSets: 3, otherSets: 2, ratio: 0.6 },
  );
});

test("beginner effort, short sessions, and injury pattern exclusions are applied", () => {
  const plan = buildFallbackPlan({
    ...profile,
    experience: "beginner",
    sessionMinutes: 25,
    injuries: "lower back and knee pain",
  });
  for (const slot of plan.days.flatMap((d) => d.exercises)) {
    assert.equal(slot.sets, 2);
    assert.equal(slot.rpe, 6);
    assert.equal(isUnsafe(slot.name, "lower back and knee pain"), false);
  }
  assert.ok(plan.days.every((d) => d.exercises.length <= 4));
});

test("plan and tweak schemas enforce integer rest/sets, ranges, unique days and nonempty tweaks", () => {
  const exercise = { name: "Pushups", sets: 3, reps: "8", restSec: 0 };
  assert.ok(confirmTweakSchema.safeParse({ exercises: [exercise] }).success);
  for (const patch of [
    { restSec: 1.5 },
    { restSec: -1 },
    { restSec: 401 },
    { sets: 1.5 },
    { sets: 0 },
    { rpe: 11 },
  ]) {
    assert.equal(
      confirmTweakSchema.safeParse({ exercises: [{ ...exercise, ...patch }] }).success,
      false,
    );
  }
  assert.equal(confirmTweakSchema.safeParse({ exercises: [] }).success, false);
  assert.equal(
    generatedSchema.safeParse({
      title: "Plan",
      days: [
        { weekday: 1, title: "A" },
        { weekday: 1, title: "B" },
      ],
    }).success,
    false,
  );
});
