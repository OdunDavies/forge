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
import { assertPlanStructure } from "./refinement.ts";

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
  assert.equal(determineSplit(6, "advanced"), "Pull / Push / Legs");
  assert.equal(determineSplit(5, "beginner"), "Upper / Lower + Pull / Push / Legs");
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
      assert.ok(day.exercises.length >= 3 && day.exercises.length <= 6);
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

test("every frequency preserves lower-body, pressing and pulling coverage", () => {
  for (const daysPerWeek of [2, 3, 4, 5, 6]) {
    const plan = buildFallbackPlan({ ...profile, daysPerWeek, availableDays: [1, 2, 3, 4, 5, 6] });
    const training = plan.days.filter((d) => !d.isRest);
    assert.equal(training.length, daysPerWeek);
    const lower = training.filter((d) => d.title.startsWith("Lower"));
    assert.equal(lower.length, daysPerWeek >= 4 ? 2 : 0);
    for (const day of lower) {
      assert.ok(
        day.exercises.every((slot) =>
          EXERCISE_CATALOG.get(slot.exerciseId)!.focusPrimary.every((m) =>
            ["quads", "hamstrings", "glutes", "calves", "core"].includes(m),
          ),
        ),
      );
    }
    for (const day of training.filter((d) => d.title.startsWith("Full Body"))) {
      const muscles = day.exercises.flatMap(
        (slot) => EXERCISE_CATALOG.get(slot.exerciseId)!.focusPrimary,
      );
      assert.ok(muscles.includes("back"));
      assert.ok(muscles.includes("chest") || muscles.includes("shoulders"));
      assert.ok(muscles.includes("quads"));
      assert.ok(muscles.includes("hamstrings") || muscles.includes("glutes"));
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

test("six-day sessions alternate pulling and pressing angles and keep two leg sessions", () => {
  const plan = buildFallbackPlan({
    ...profile,
    daysPerWeek: 6,
    availableDays: [1, 2, 3, 4, 5, 6],
    focusMuscles: [],
  });
  const training = plan.days.filter((d) => !d.isRest);
  assert.match(training[0].title, /Back.* A/);
  assert.match(training[0].exercises[0].name, /Row/);
  assert.match(training[3].exercises[0].name, /Pulldown|Pull-Up|Chin-Up/);
  assert.match(training[1].exercises[0].name, /Bench Press/);
  assert.match(training[4].exercises[0].name, /Incline/);
  assert.notDeepEqual(
    training[0].exercises.map((e) => e.exerciseId),
    training[3].exercises.map((e) => e.exerciseId),
  );
  assert.equal(training.filter((d) => d.title.startsWith("Lower")).length, 2);
  assert.ok(
    training
      .filter((d) => d.title.startsWith("Back"))
      .every((d) => d.exercises.some((e) => /Calf/.test(e.name))),
  );
});

test("all-seven availability reserves a recovery day and beginner six-day workload stays conservative", () => {
  const plan = buildFallbackPlan({
    ...profile,
    daysPerWeek: 7,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    experience: "beginner",
  });
  assert.equal(plan.days[0].isRest, true);
  assert.equal(plan.days.filter((d) => !d.isRest).length, 6);
  assert.ok(plan.days.flatMap((d) => d.exercises).every((e) => e.sets === 2 && e.rpe === 6));
});

test("higher frequencies obey equipment and injury filters even when a movement is unavailable", () => {
  for (const equipment of [["body only"], ["dumbbell"], ["barbell"], ["full gym"]]) {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const injuries = "shoulder and lower back pain";
      const plan = buildFallbackPlan({
        ...profile,
        equipment,
        daysPerWeek,
        availableDays: [1, 2, 3, 4, 5, 6],
        injuries,
      });
      for (const slot of plan.days.flatMap((d) => d.exercises)) {
        const ex = EXERCISE_CATALOG.get(slot.exerciseId)!;
        assert.equal(isUnsafe(slot.name, injuries), false);
        assert.ok(
          equipment.includes("full gym") ||
            ex.equipmentGroup.every((g) => g === "body only" || equipment.includes(g)),
        );
      }
    }
  }
});

test("focus accessories add emphasis without displacing the main patterns", () => {
  const make = (focusMuscles: string[]) =>
    buildFallbackPlan({ ...profile, focusMuscles }).days.filter((d) => !d.isRest);
  const balanced = make([]);
  const focused = make(["chest"]);
  const countChest = (days: typeof balanced) =>
    days
      .flatMap((d) => d.exercises)
      .filter((e) => EXERCISE_CATALOG.get(e.exerciseId)!.focusPrimary.includes("chest")).length;
  assert.ok(countChest(focused) > countChest(balanced));
  assert.ok(
    focused.every((d) =>
      d.exercises.some((e) => EXERCISE_CATALOG.get(e.exerciseId)!.focusPrimary.includes("quads")),
    ),
  );
});

test("AI refinement may explain the program but cannot alter its exercises, effort or schedule", () => {
  const plan = buildFallbackPlan(profile);
  const base = generatedSchema.parse({
    ...plan,
    days: plan.days.map((d) => ({ ...d, notes: d.coachNotes })),
  });
  const good = structuredClone(base);
  good.rationale = "Build strength steadily.";
  assert.doesNotThrow(() => assertPlanStructure(good, base));
  const mutations = [
    (p: typeof base) => {
      p.split = "Other";
    },
    (p: typeof base) => {
      p.days[1].title = "Other";
    },
    (p: typeof base) => {
      p.days[0].isRest = false;
    },
    (p: typeof base) => {
      p.days[1].exercises![0].exerciseId = "Unknown_Exercise";
    },
    (p: typeof base) => {
      p.days[1].exercises![0].name = "Unsafe invented lift";
    },
    (p: typeof base) => {
      p.days[1].exercises![0].sets = 8;
    },
    (p: typeof base) => {
      p.days[1].exercises![0].rpe = 10;
    },
    (p: typeof base) => {
      p.days[1].exercises![0].reps = "1";
    },
    (p: typeof base) => {
      p.days[1].exercises![0].restSec = 0;
    },
    (p: typeof base) => {
      p.days[1].exercises!.reverse();
    },
    (p: typeof base) => {
      p.days[1].exercises!.pop();
    },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(base);
    mutate(candidate);
    assert.throws(() => assertPlanStructure(candidate, base));
  }
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
