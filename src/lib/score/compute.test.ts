import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyLift,
  computeConsistency,
  computeForgeScore,
  computeProgression,
  computeStrength,
  DAY_MS,
} from "./compute.ts";
import { calculateStreak, nextRankGap, rankForXp } from "../gamification/config.ts";
import { getBadgeProgress } from "../gamification/badges.ts";
import { workoutFacts } from "../gamification/compute.ts";
import type { ScoreProfile } from "./compute.ts";
import type { SessionSet, WorkoutSession } from "../api/types.ts";

const now = Date.parse("2026-09-29T12:00:00Z");
const profile: ScoreProfile = {
  sex: "male",
  experience: "beginner",
  daysPerWeek: 4,
  focusMuscles: ["chest"],
};
const resolve = () => ({ primary: ["chest"], secondary: [] });
function set(patch: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 1,
    exerciseId: "bench",
    exerciseName: "Bench Press",
    setIndex: 1,
    weightKg: 50,
    reps: 5,
    rpe: null,
    completed: true,
    isWarmup: false,
    isPr: false,
    ...patch,
  };
}
function session(id: number, daysAgo = 0, sets = [set()]): WorkoutSession {
  const date = new Date(now - daysAgo * DAY_MS).toISOString();
  return {
    id,
    userId: "owner",
    title: "Workout",
    planDayId: null,
    startedAt: date,
    completedAt: date,
    durationSec: 1200,
    bodyweightKg: null,
    energy: null,
    soreness: null,
    notes: "",
    visibility: "private",
    volumeKg: 0,
    setCount: 0,
    prCount: 0,
    photoUrl: null,
    sets,
  };
}

test("score is deterministic, bounded and calibrates only real recent finished workouts", () => {
  const workouts = [session(1), session(2, 2), session(3, 4)];
  const result = computeForgeScore(profile, workouts, now, resolve);
  assert.deepEqual(result, computeForgeScore(profile, workouts, now, resolve));
  assert.equal(result.calibrated, true);
  assert.ok(result.score >= 0 && result.score <= 100);
  const invalid = [
    session(4, 0, [set({ completed: false })]),
    session(5, 0, [set({ isWarmup: true })]),
    { ...session(6), completedAt: null },
    session(7, -1),
    session(8, 29),
  ];
  const empty = computeForgeScore(profile, invalid, now, resolve);
  assert.equal(empty.calibrated, false);
  assert.deepEqual(empty.pillars, { consistency: 0, strength: 0, progression: 0, focus: 0 });
  assert.equal(
    computeForgeScore(profile, [workouts[0], workouts[0], workouts[0]], now).calibrated,
    false,
  );
});

test("consistency counts actual unique training dates against planned frequency", () => {
  const workouts = Array.from({ length: 16 }, (_, i) => session(i, i));
  assert.equal(computeConsistency(workouts, 28, now, 4), 100);
  assert.equal(computeConsistency([session(1), session(2)], 28, now, 4), 6);
  assert.equal(computeConsistency([session(1, 28)], 28, now, 4), 0);
});

test("strength excludes warmups and unrelated press/squat/deadlift variations and tolerates invalid sex", () => {
  for (const name of [
    "Leg Press",
    "Triceps Pressdown",
    "Dumbbell Bench Press",
    "Romanian Deadlift",
    "Hack Squat",
    "Incline Bench Press",
  ])
    assert.equal(classifyLift(name), null);
  assert.equal(classifyLift("Barbell Bench Press"), "bench");
  assert.equal(classifyLift("Standing Military Press"), "overheadPress");
  const workouts = [
    session(1, 0, [
      set({ isWarmup: true, weightKg: 500 }),
      set({ exerciseName: "Leg Press", weightKg: 500 }),
    ]),
  ];
  assert.equal(computeStrength(profile, workouts), 0);
  assert.ok(Number.isFinite(computeStrength({ ...profile, sex: "other" }, [session(1)])));
});

test("progression compares the best real set across intervening workouts and reaches full scale", () => {
  const workouts = [
    session(1, 6, [set({ weightKg: 50 }), set({ weightKg: 500, completed: false })]),
    session(2, 4, [set({ exerciseId: "squat", exerciseName: "Squat" })]),
    session(3, 2, [set({ weightKg: 60 })]),
  ];
  assert.equal(computeProgression(workouts), 100);
  assert.equal(
    computeProgression([
      session(1, 4, [set({ weightKg: 60 })]),
      session(2, 2, [set({ weightKg: 50 })]),
    ]),
    0,
  );
  assert.equal(computeProgression([]), 0);
});

test("focus uses catalog evidence and excludes warmups and placeholders", () => {
  const workouts = [
    session(1, 0, [
      set(),
      set({ exerciseId: "other", weightKg: 100, isWarmup: true }),
      set({ completed: false, weightKg: 1000 }),
    ]),
  ];
  assert.equal(computeForgeScore(profile, workouts, now, resolve).pillars.focus, 100);
  assert.equal(computeForgeScore(profile, workouts, now).pillars.focus, 0);
});

test("ranks select highest eligible floor and never have a negative next-rank gap", () => {
  assert.equal(rankForXp(1500).name, "Steel");
  assert.equal(rankForXp(20000).name, "Adamant");
  assert.equal(nextRankGap(20000), 0);
});

test("streak uses finite actual history, separates current and best, and preserves missing weeks", () => {
  assert.deepEqual(calculateStreak([], 4), { streak: 0, bestStreak: 0 });
  assert.deepEqual(calculateStreak([3], 4), { streak: 1, bestStreak: 1 });
  assert.deepEqual(calculateStreak([0, 3, 3, 3, 3], 4), { streak: 0, bestStreak: 4 });
  const workouts = [session(1, 0), session(2, 1), session(3, 14), session(4, 15)];
  const result = workoutFacts({ ...profile, daysPerWeek: 2 }, workouts, now, resolve);
  assert.equal(result.streak, 1);
  assert.equal(result.bestStreak, 1);
});

test("badge progress and earned thresholds agree without fake onboarding, shares or coach tweaks", () => {
  const facts = {
    sessionCount: 1,
    prCount: 0,
    bestStreak: 1,
    focusWeeks: 0,
    lifetimeVolume: 5000,
    coachTweaks: 0,
    shares: 0,
  };
  assert.equal(getBadgeProgress(facts, "firstSession").earned, true);
  assert.equal(getBadgeProgress(facts, "tenSessions").earned, false);
  assert.equal(getBadgeProgress(facts, "tenSessions").progress, 10);
  assert.equal(getBadgeProgress(facts, "lifetimeVolume10k").progress, 50);
  assert.equal(getBadgeProgress(facts, "lifetimeVolume10k").earned, false);
  assert.equal(getBadgeProgress(facts, "fourWeekStreak").earned, false);
  assert.equal(getBadgeProgress(facts, "firstShare").progress, 0);
  assert.equal(getBadgeProgress(facts, "firstCoachTweak").earned, false);
});
