import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeForgeScore, computeProgression } from "./compute.ts";
import type { Profile, WorkoutSession, SessionSet } from "../api/types.ts";
const now = Date.parse("2026-09-29T12:00:00Z");
const profile: Profile = {
  userId: "test", handle: "athlete", displayName: "Athlete", bio: "", sex: "male", birthYear: 1990,
  heightCm: 180, weightKg: 80, units: "metric", experience: "intermediate", goal: "strength",
  daysPerWeek: 4, sessionMinutes: 60, equipment: [], injuries: "", availableDays: [1,2,4,5],
  focusMuscles: ["chest"], onboardedAt: "2026-09-01", plan: "free", baseline_lifts: {},
  personalRecords: {}, sessionHistory: [], trainedDaysPerWeek: [], focusWeekHistory: [],
  tweaksApplied: [], sharedSessions: [], xp: 0, xpThisWeek: 0,
};
const set = (overrides: Partial<SessionSet> = {}): SessionSet => ({
  id: 1, exerciseId: null, exerciseName: "Barbell Bench Press - Medium Grip", setIndex: 1,
  weightKg: 60, reps: 8, rpe: 8, completed: true, isWarmup: false, isPr: false, ...overrides,
});
const session = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 1, userId: "test", title: "Upper", planDayId: null, startedAt: new Date(now-3600000).toISOString(),
  completedAt: new Date(now).toISOString(), durationSec: 3600, bodyweightKg: 80, energy: 4, soreness: 2,
  notes: "", visibility: "private", volumeKg: 480, setCount: 1, prCount: 0, photoUrl: null, sets: [set()], ...overrides,
});
describe("Forge Score", () => {
  it("requires three completed sessions in its window", () => {
    assert.equal(computeForgeScore(profile, [session(), session({completedAt:null}), session({startedAt:"invalid"})], now).calibrated, false);
    assert.equal(computeForgeScore(profile, [session(),session(),session()], now).calibrated, true);
  });
  it("excludes future and stale sessions", () => {
    const result = computeForgeScore(profile, [session({startedAt:"2027-01-01"}), session({startedAt:"2020-01-01"})], now);
    assert.equal(result.score, 0); assert.equal(result.pillars.consistency, 0);
  });
  it("does not award strength or focus for warmups or unlogged sets", () => {
    const result = computeForgeScore(profile, [session({sets:[set({completed:false}),set({isWarmup:true})]})], now);
    assert.equal(result.pillars.strength, 0); assert.equal(result.pillars.focus, 0);
  });
  it("maps the bundled catalog to focus muscles", () => {
    assert.equal(computeForgeScore(profile, [session()], now).pillars.focus, 100);
  });
  it("uses the best working set and recognizes improvement", () => {
    const older = session({startedAt:new Date(now-86400000).toISOString()});
    assert.ok(computeProgression([older, session({sets:[set({weightKg:65})]})]) > 50);
    assert.equal(computeProgression([older, session()]), 50);
  });
  it("bounds every score and supports an unspecified sex", () => {
    const result = computeForgeScore({...profile,sex:"prefer_not_to_say"}, [session(),session(),session()], now);
    for (const value of Object.values(result.pillars)) assert.ok(value >= 0 && value <= 100);
    assert.ok(result.narrative.length > 0);
  });
});
