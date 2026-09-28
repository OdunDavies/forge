import { STANDARDS, EXPERIENCE_BLEND, SCORING_WEIGHTS, PILLAR_THRESHOLDS, CONSISTENCY_WINDOW_DAYS, MIN_SESSIONS_FOR_SCORE } from "./config"
import type { Profile } from "@/lib/api/profile"
import type { WorkoutSession } from "@/lib/api/sessions"

export type Pillars = {
  consistency: number // 0-100
  strength: number // 0-100
  progression: number // 0-100
  focus: number // 0-100
}

export type ScoreResult = {
  score: number // 0-100
  pillars: Pillars
  narrative: string
  minSessions: number
  calibrated: boolean
}

/**
 * Compute the four pillar scores for a user based on their profile and session history.
 * 
 * @param profile User profile with onboarding choices and baseline lifts
 * @param sessions Array of completed workout sessions
 * @returns Score result with pillar scores and narrative
 */
export function computeForgeScore(
  profile: Profile,
  sessions: WorkoutSession[]
): ScoreResult {
  // 1. Consistency: ratio of active weeks to total weeks in window
  const consistency = computeConsistency(sessions, CONSISTENCY_WINDOW_DAYS)

  // 2. Strength: compare best estimated 1RM totals against standards
  const strength = computeStrength(profile, sessions)

  // 3. Progression: measure weight/reps improvement over time
  const progression = computeProgression(sessions)

  // 4. Focus: volume percentage on focus muscles from baseline_lifts
  const focus = computeFocus(profile, sessions)

  // Combine with weights
  const totalScore =
    consistency * SCORING_WEIGHTS.consistency +
    strength * SCORING_WEIGHTS.strength +
    progression * SCORING_WEIGHTS.progression +
    focus * SCORING_WEIGHTS.focus

  // Generate narrative
  const narrative = generateNarrative({ consistency, strength, progression, focus }, totalScore)

  return {
    score: Math.round(totalScore),
    pillars: { consistency, strength, progression, focus },
    narrative,
    minSessions: MIN_SESSIONS_FOR_SCORE,
    calibrated: sessions.length >= MIN_SESSIONS_FOR_SCORE,
  }
}

/**
 * Compute consistency score (0-100) based on session frequency over the rolling window.
 */
function computeConsistency(
  sessions: WorkoutSession[],
  windowDays: number
): number {
  if (sessions.length === 0) return 0

  // Group sessions by week (ISO week start Monday)
  const weekMap = new Map<string, number>()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt)
    if (startedAt < cutoff) continue

    // Get week start Monday
    const day = startedAt.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const monday = startedAt.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(startedAt)
    weekStart.setDate(monday)
    const key = weekStart.toISOString().split("T")[0]
    weekMap.set(key, (weekMap.get(key) || 0) + 1)
  }

  // Count unique weeks with at least 1 session
  const activeWeeks = weekMap.size
  const totalWeeks = Math.max(1, Math.ceil((windowDays + 1) / 7))

  // Consistency: percentage of weeks with at least 1 session
  const ratio = activeWeeks / totalWeeks
  return Math.round(ratio * 100)
}

/**
 * Compute strength score (0-100) based on lifts vs standards.
 */
function computeStrength(profile: Profile, sessions: WorkoutSession[]): number {
  const baselineLifts = profile.baseline_lifts ?? {}
  const experience = profile.experience ?? "intermediate"
  // Determine sex from profile if available; default to male for standard blending
  const sex: "male" | "female" = (profile.sex ?? "male") as "male" | "female"

  // If no baseline lifts, start from experience-blended standard
  if (Object.keys(baselineLifts).length === 0) {
    const blend = EXPERIENCE_BLEND[experience as keyof typeof EXPERIENCE_BLEND] ?? 0.5
    const standard = blendStandard(experience, sex, blend)
    // No baseline -> score based on gap to standard (inverted, capped)
    const gap = 50 // neutral midpoint when no data
    return Math.max(0, Math.min(100, 50 - gap + 50))
  }

  // Extract best estimated 1RM from sessions for each lift
  const estimated1RMs = extractEstimated1RMs(sessions)

  // Compare each lift to standard, then average
  const lifts: (keyof typeof STANDARDS.beginner.male)[] = [
    "squat",
    "bench",
    "deadlift",
    "overheadPress",
  ]

  let totalScore = 0
  let count = 0

  for (const lift of lifts) {
    const user1RM = estimated1RMs[lift] ?? 0
    const standard = standardForLift(experience, sex, lift)
    if (standard > 0) {
      // Score: how close user is to standard, with diminishing returns above standard
      const ratio = Math.min(1, user1RM / standard)
      const liftScore = Math.round(ratio * 100)
      totalScore += liftScore
      count++
    }
  }

  return count > 0 ? Math.round(totalScore / count) : 50
}

/**
 * Compute progression score (0-100) based on session-to-session improvements.
 */
function computeProgression(sessions: WorkoutSession[]): number {
  if (sessions.length < 2) return 50 // neutral when insufficient data

  // Sort sessions by start date descending (most recent first)
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  // Compare each consecutive pair of sessions for the same exercises
  let totalImprovement = 0
  let comparisonCount = 0

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const previous = sorted[i + 1]

    // Get common exercises
    const currentExercises = new Set(
      (current.sets ?? []).map((s: any) => s.exerciseName)
    )
    const previousExercises = new Set(
      (previous.sets ?? []).map((s: any) => s.exerciseName)
    )
    const common = [...currentExercises].filter((x) => previousExercises.has(x))

    for (const exercise of common) {
      const currentSet = (current.sets ?? []).find((s: any) => s.exerciseName === exercise)
      const previousSet = (previous.sets ?? []).find((s: any) => s.exerciseName === exercise)

      if (currentSet && previousSet && currentSet.weightKg != null && previousSet.weightKg != null) {
        // Weight progression
        const weightDiff = currentSet.weightKg - previousSet.weightKg!
        if (weightDiff > 0) {
          totalImprovement += Math.min(25, weightDiff) // cap at 25 per exercise
        }
        comparisonCount++
      }
    }
  }

  if (comparisonCount === 0) return 50

  const avgImprovement = totalImprovement / comparisonCount
  // Normalize to 0-100: assume ~50kg progression over ~10 comparisons = 5 points each
  const normalized = Math.min(100, (avgImprovement / 50) * 100)
  return Math.round(normalized)
}

/**
 * Compute focus score (0-100) based on volume on focus muscles vs baseline_lifts.
 */
function computeFocus(profile: Profile, sessions: WorkoutSession[]): number {
  const focusMuscles = profile.focusMuscles ?? []
  const baselineLifts = profile.baseline_lifts ?? {}

  if (focusMuscles.length === 0 || Object.keys(baselineLifts).length === 0) {
    return 50 // neutral when no focus defined
  }

  // Calculate total volume on focus muscles from recent sessions
  let focusVolume = 0
  let totalVolume = 0

  // Get sessions in the scoring window
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CONSISTENCY_WINDOW_DAYS)

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt)
    if (startedAt < cutoff) continue

    for (const set of session.sets ?? []) {
      const exerciseName = set.exerciseName ?? ""
      const weight = set.weightKg ?? 0
      const reps = set.reps ?? 0
      const volume = weight * (reps || 0)

      totalVolume += volume

      // Check if this exercise targets a focus muscle
      // Simple heuristic: if focus muscle name appears in exercise name or baseline lift key
      for (const muscle of focusMuscles) {
        if (exerciseName.toLowerCase().includes(muscle.toLowerCase()) || 
            baselineLifts[muscle]) {
          focusVolume += volume
          break
        }
      }
    }
  }

  if (totalVolume === 0) return 50

  const focusRatio = focusVolume / totalVolume
  return Math.round(focusRatio * 100)
}

/**
 * Extract estimated 1RM for each major lift from sessions.
 */
function extractEstimated1RMs(sessions: WorkoutSession[]): Record<string, number> {
  const result: Record<string, number> = {
    squat: 0,
    bench: 0,
    deadlift: 0,
    overheadPress: 0,
  }

  // Find the heaviest working set for each lift type
  for (const session of sessions) {
    for (const set of session.sets ?? []) {
      const name = (set.exerciseName ?? "").toLowerCase()
      const weight = set.weightKg ?? 0
      const reps = parseInt(String(set.reps ?? 0), 10) || 1

      if (name.includes("squat") || name.includes("back squat") || name.includes("front squat")) {
        result.squat = Math.max(result.squat, epley1RM(weight, reps))
      } else if (name.includes("bench") || name.includes("flat bench")) {
        result.bench = Math.max(result.bench, epley1RM(weight, reps))
      } else if (name.includes("deadlift")) {
        result.deadlift = Math.max(result.deadlift, epley1RM(weight, reps))
      } else if (name.includes("overhead") || name.includes("press") || name.includes("military")) {
        result.overheadPress = Math.max(result.overheadPress, epley1RM(weight, reps))
      }
    }
  }

  return result
}

/** Helper: Epley formula for 1RM estimation */
function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return weight
  return weight * (1 + reps / 30)
}

/**
 * Get the standard for a given lift based on experience, sex, and blend factor.
 */
function blendStandard(
  experience: string,
  sex: "male" | "female",
  blend: number
): Record<string, number> {
  const std = { ...STANDARDS.beginner.male, ...STANDARDS.beginner.female } as Record<string, number>
  
  // Select the appropriate experience tier
  const tier = experience === "advanced" ? "advanced" : experience === "intermediate" ? "intermediate" : "beginner"
  const experienceStd = STANDARDS[tier as keyof typeof STANDARDS]
  
  // Merge male/female, applying blend
  for (const lift of ["squat", "bench", "deadlift", "overheadPress"] as (keyof typeof STANDARDS.beginner.male)[]) {
    const maleVal = experienceStd.male[lift]
    const femaleVal = experienceStd.female[lift]
    // Blend: blend % from male, (1-blend) % from female
    std[lift] = maleVal * blend + femaleVal * (1 - blend)
  }
  
  return std
}

/** Get the standard for a specific lift (non-blended, fixed tier) */
function standardForLift(experience: string, sex: "male" | "female", lift: keyof typeof STANDARDS.beginner.male): number {
  const tier = experience === "advanced" ? "advanced" : experience === "intermediate" ? "intermediate" : "beginner"
  const experienceStd = STANDARDS[tier as keyof typeof STANDARDS]
  // Use type assertion to access the specific tier's sex/lift properties
  return (experienceStd as any)[sex][lift]
}

/**
 * Generate a human-readable narrative from the pillar scores.
 */
function generateNarrative(pillars: Pillars, totalScore: number): string {
  const { consistency, strength, progression, focus } = pillars
  const weakest = ["consistency", "strength", "progression", "focus"]
    .map((key, i) => ({ key, score: pillars[key as keyof Pillars] }))
    .sort((a, b) => a.score - b.score)[0]

  const strengths: string[] = []
  if (consistency >= 80) strengths.push("consistent training")
  if (strength >= 80) strengths.push("strong lifts")
  if (progression >= 80) strengths.push("good progression")
  if (focus >= 80) strengths.push("focused muscle development")

  const weaknesses: string[] = []
  if (consistency < PILLAR_THRESHOLDS.consistency) weaknesses.push("inconsistent sessions")
  if (strength < PILLAR_THRESHOLDS.strength) weaknesses.push("room for strength gains")
  if (progression < PILLAR_THRESHOLDS.progression) weaknesses.push("stalling progression")
  if (focus < PILLAR_THRESHOLDS.focus) weaknesses.push("expand focus muscle volume")

  let narrative = `Forge Score: ${totalScore}`

  if (weakest) {
    narrative += ` — your weakest pillar is ${weakest.key}`
  }

  if (strengths.length > 0) {
    narrative += ` — you're excelling at ${strengths.join(" and ")}`
  }

  if (weaknesses.length > 0) {
    narrative += `. ${weaknesses.join(". ")}`
  }

  return narrative
}

