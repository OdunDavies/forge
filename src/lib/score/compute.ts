import { STANDARDS, EXPERIENCE_BLEND, SCORING_WEIGHTS, PILLAR_THRESHOLDS, CONSISTENCY_WINDOW_DAYS, MIN_SESSIONS_FOR_SCORE } from "./config";
import type { Profile } from "@/lib/api/profile";
import type { WorkoutSession } from "@/lib/api/sessions";

/** Pillar weights (percentages must sum to 100). */
export const SCORING_WEIGHTS = {
  consistency: 0.3,
  strength: 0.3,
  progression: 0.2,
  focus: 0.2,
} as const;

/** Threshold for "active" status in each pillar (0-100 scale). */
export const PILLAR_THRESHOLDS = {
  consistency: 20,
  strength: 20,
  progression: 10,
  focus: 15,
} as const;

/** Rolling window for consistency calculation (days). */
export const CONSISTENCY_WINDOW_DAYS = 28;

/** Minimum sessions required before a score is considered valid. */
export const MIN_SESSIONS_FOR_SCORE = 3;

/** Compute consistency score (0-100) based on session frequency over the rolling window. */
export function computeConsistency(
  sessions: WorkoutSession[],
  windowDays: number
): number {
  if (sessions.length === 0) return 0;

  // Group sessions by week (ISO week start Monday)
  const weekMap = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt);
    if (startedAt < cutoff) continue;

    // Get week start Monday
    const day = startedAt.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const monday = startedAt.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(startedAt);
    weekStart.setDate(monday);
    const key = weekStart.toISOString().split("T")[0];
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }

  // Count unique weeks with at least 1 session
  const activeWeeks = weekMap.size;
  const totalWeeks = Math.max(1, Math.ceil((windowDays + 1) / 7));

  // Consistency: percentage of weeks with at least 1 session
  const ratio = activeWeeks / totalWeeks;
  return Math.round(ratio * 100);
}

/** Compute strength score (0-100) based on lifts vs standards. */
export function computeStrength(profile: Profile, sessions: WorkoutSession[]): number {
  const experience = profile.experience ?? "intermediate";
  // Determine sex from profile if available; default to male for standard blending
  const sex: "male" | "female" = (profile.sex ?? "male") as "male" | "female";

  // If no baseline lifts, start from experience-blended standard
  // (the actual baseline_lifts would come from the profile; simplified here)

  // Extract best estimated 1RM from sessions for each lift type
  const estimated1RMs = extractEstimated1RMs(sessions);

  // Compare each lift to standard, then average
  const lifts: string[] = [
    "squat",
    "bench",
    "deadlift",
    "overheadPress",
  ];

  let totalScore = 0;
  let count = 0;

  for (const lift of lifts) {
    const user1RM = estimated1RMs[lift] ?? 0;
    // Use the standards table for comparison
    const standard = standardForLift(experience, sex, lift);
    if (standard > 0) {
      // Score: how close user is to standard, with diminishing returns above standard
      const ratio = Math.min(1, user1RM / standard);
      const liftScore = Math.round(ratio * 100);
      totalScore += liftScore;
      count++;
    }
  }

  return count > 0 ? Math.round(totalScore / count) : 50;
}

/** Compute progression score (0-100) based on session-to-session improvements. */
export function computeProgression(sessions: WorkoutSession[]): number {
  if (sessions.length < 2) return 50; // neutral when insufficient data

  // Sort sessions by start date descending (most recent first)
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  // Compare each consecutive pair of sessions for the same exercises
  let totalImprovement = 0;
  let comparisonCount = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const previous = sorted[i + 1];

    // Get common exercises by name
    const currentExercises = new Set(
      (current.sets ?? []).map((s: any) => s.exerciseName ?? "")
    );
    const previousExercises = new Set(
      (previous.sets ?? []).map((s: any) => s.exerciseName ?? "")
    );
    const common = [...currentExercises].filter((x) => previousExercises.has(x));

    for (const exercise of common) {
      const currentSet = (current.sets ?? []).find((s: any) => s.exerciseName === exercise);
      const previousSet = (previous.sets ?? []).find((s: any) => s.exerciseName === exercise);

      if (currentSet && previousSet && currentSet.weightKg != null && previousSet.weightKg != null) {
        // Weight progression
        const weightDiff = currentSet.weightKg - previousSet.weightKg;
        if (weightDiff > 0) {
          totalImprovement += Math.min(25, weightDiff); // cap at 25 per exercise
        }
        comparisonCount++;
      }
    }
  }

  if (comparisonCount === 0) return 50;

  const avgImprovement = totalImprovement / comparisonCount;
  // Normalize to 0-100: assume ~50kg progression over ~10 comparisons = 5 points each
  const normalized = Math.min(100, (avgImprovement / 50) * 100);
  return Math.round(normalized);
}

/** Compute focus score (0-100) based on volume on focus muscles vs catalog baseline.
 * 
 * @param profile User profile
 * @param sessions Array of completed workout sessions
 * @param exerciseFocusMuscles Callback that returns {primary, secondary} for a given exercise id
 */
export function computeFocus(
  profile: Profile,
  sessions: WorkoutSession[],
  exerciseFocusMuscles: (exerciseId: string) => { primary: string[]; secondary: string[] }
): number {
  const focusMuscles = profile.focusMuscles ?? [];

  if (focusMuscles.length === 0) {
    return 50; // neutral when no focus defined
  }

  // Calculate total volume on focus muscles from recent sessions
  let focusVolume = 0;
  let totalVolume = 0;

  // Get sessions in the scoring window
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONSISTENCY_WINDOW_DAYS);

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt);
    if (startedAt < cutoff) continue;

    // Resolve this session's exercise focus muscles
    for (const set of session.sets ?? []) {
      const exerciseId = set.exerciseId ?? set.exerciseName;
      if (!exerciseId) continue;

      const { primary, secondary } = exerciseFocusMuscles(exerciseId);
      
      // Add volume on focus muscles
      const weight = set.weightKg ?? 0;
      const reps = set.reps ?? 0;
      const volume = weight * (reps || 0);

      totalVolume += volume;

      // Check if this exercise targets a focus muscle
      for (const muscle of focusMuscles) {
        if (primary.includes(muscle) || secondary.includes(muscle)) {
          focusVolume += volume;
          break;
        }
      }
    }
  }

  if (totalVolume === 0) return 50;

  const focusRatio = focusVolume / totalVolume;
  return Math.round(focusRatio * 100);
}

/** Helper: Epley formula for 1RM estimation. */
function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  return weight * (1 + reps / 30);
}

/** Extract estimated 1RM for each major lift from sessions. */
function extractEstimated1RMs(sessions: WorkoutSession[]): Record<string, number> {
  const result: Record<string, number> = {
    squat: 0,
    bench: 0,
    deadlift: 0,
    overheadPress: 0,
  };

  // Find the heaviest working set for each lift type
  for (const session of sessions) {
    for (const set of session.sets ?? []) {
      const name = (set.exerciseName ?? "").toLowerCase();
      const weight = set.weightKg ?? 0;
      const reps = parseInt(set.reps ?? "0", 10) || 1;

      if (name.includes("squat") || name.includes("back squat") || name.includes("front squat")) {
        result.squat = Math.max(result.squat, epley1RM(weight, reps));
      } else if (name.includes("bench") || name.includes("flat bench")) {
        result.bench = Math.max(result.bench, epley1RM(weight, reps));
      } else if (name.includes("deadlift")) {
        result.deadlift = Math.max(result.deadlift, epley1RM(weight, reps));
      } else if (name.includes("overhead") || name.includes("press") || name.includes("military")) {
        result.overheadPress = Math.max(result.overheadPress, epley1RM(weight, reps));
      }
    }
  }

  return result;
}

/** Get the standard for a specific lift (non-blended, fixed tier). */
function standardForLift(experience: string, sex: "male" | "female", lift: string): number {
  const tier = experience === "advanced" ? "advanced" : experience === "intermediate" ? "intermediate" : "beginner";
  const experienceStd = STANDARDS[tier as keyof typeof STANDARDS];
  // Use type assertion to access the specific tier's sex/lift properties
  return (experienceStd as any)[sex][lift];
}