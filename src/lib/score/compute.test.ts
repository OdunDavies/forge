import { describe, it, expect, beforeEach } from "vitest"
import { computeForgeScore, type ScoreResult } from "./compute"
import type { Profile } from "@/lib/api/profile"
import type { WorkoutSession } from "@/lib/api/sessions"

// Mock profile and sessions for testing
const defaultProfile: Profile = {
  userId: "test-user",
  handle: "test-athlete",
  displayName: "Test Athlete",
  bio: "",
  sex: "male",
  birthYear: 1990,
  heightCm: 180,
  weightKg: 80,
  units: "metric",
  experience: "intermediate",
  goal: "strength",
  daysPerWeek: 4,
  sessionMinutes: 60,
  equipment: [],
  injuries: "",
  availableDays: [1, 2, 3, 4],
  focusMuscles: [],
  onboardedAt: new Date().toISOString(),
  plan: "free",
  baseline_lifts: {},
}

const mockSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: "session-1",
  user_id: "test-user",
  plan_day_id: 1,
  title: "Workout A",
  started_at: new Date().toISOString(),
  completed_at: new Date(Date.now() - 3600000).toISOString(),
  duration_sec: 3600,
  bodyweight_kg: 80,
  energy: 7,
  soreness: 3,
  notes: "",
  visibility: "public",
  volume_kg: 0,
  set_count: 0,
  pr_count: 0,
  ...overrides,
})

describe("computeForgeScore", () => {
  it("returns calibrated=false when fewer than 3 sessions", () => {
    const profile = { ...defaultProfile, baseline_lifts: {} }
    const sessions = [mockSession({ id: "s1" })]
    const result = computeForgeScore(profile, sessions)
    expect(result.calibrated).toBe(false)
  })

  it("returns calibrated=true with 3+ sessions", () => {
    const profile = { ...defaultProfile, baseline_lifts: {} }
    const sessions = [mockSession(), mockSession(), mockSession()]
    const result = computeForgeScore(profile, sessions)
    expect(result.calibrated).toBe(true)
  })

  it("computes consistency pillar", () => {
    const profile = { ...defaultProfile, baseline_lifts: {} }
    // 4 sessions across 2 weeks in 28-day window
    const sessions = Array.from({ length: 4 }, (_, i) => mockSession({
      id: `s${i}`,
      started_at: new Date(Date.now() - i * 604800000).toISOString(), // weekly
    }))
    const result = computeForgeScore(profile, sessions)
    expect(result.pillars.consistency).toBeGreaterThan(0)
    expect(result.pillars.consistency).toBeLessThanOrEqual(100)
  })

  it("computes strength pillar with baseline lifts", () => {
    const profile = {
      ...defaultProfile,
      baseline_lifts: {
        squat: 100,
        bench: 60,
        deadlift: 120,
        overheadPress: 40,
      },
    }
    const sessions = [
      mockSession({
        sets: [
          { exerciseName: "squat", weightKg: 100, reps: 5 },
          { exerciseName: "bench", weightKg: 60, reps: 5 },
        ] as any,
      }),
    ]
    const result = computeForgeScore(profile, sessions)
    expect(result.pillars.strength).toBeGreaterThan(0)
    expect(result.pillars.strength).toBeLessThanOrEqual(100)
  })

  it("computes focus pillar when focus muscles defined", () => {
    const profile = {
      ...defaultProfile,
      focusMuscles: ["quads", "chest"],
      baseline_lifts: {
        squat: 100,
        bench: 60,
      },
    }
    const sessions = [
      mockSession({
        sets: [
          { exerciseName: "squat", weightKg: 100, reps: 5 },
          { exerciseName: "bench", weightKg: 60, reps: 5 },
        ] as any,
      }),
    ]
    const result = computeForgeScore(profile, sessions)
    expect(result.pillars.focus).toBeGreaterThan(0)
    expect(result.pillars.focus).toBeLessThanOrEqual(100)
  })

  it("generates narrative with score", () => {
    const profile = { ...defaultProfile, baseline_lifts: {} }
    const sessions = [mockSession(), mockSession(), mockSession()]
    const result = computeForgeScore(profile, sessions)
    expect(typeof result.narrative).toBe("string")
    expect(result.narrative.length).toBeGreaterThan(0)
  })
})