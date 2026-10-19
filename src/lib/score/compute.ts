import {
  CONSISTENCY_WINDOW_DAYS,
  MIN_SESSIONS_FOR_SCORE,
  SCORING_WEIGHTS,
  STANDARDS,
} from "./config.ts";
import type { Profile, SessionSet, WorkoutSession } from "../api/types.ts";
import { TARGET_TO_FOCUS_PRIMARY } from "../exercises/taxonomy.ts";

export type ScoreProfile = Pick<Profile, "sex" | "experience" | "daysPerWeek" | "focusMuscles">;
export type MuscleResolver = (id: string) => { primary: string[]; secondary: string[] };
export interface ScoreResult {
  score: number;
  pillars: { consistency: number; strength: number; progression: number; focus: number };
  narrative: string;
  calibrated: boolean;
}
export const DAY_MS = 86_400_000;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function isWorkingSet(set: SessionSet): boolean {
  return (
    set.completed &&
    !set.isWarmup &&
    Number.isInteger(set.reps) &&
    (set.reps ?? 0) > 0 &&
    (set.weightKg === null || (Number.isFinite(set.weightKg) && set.weightKg >= 0))
  );
}

export function completedWorkouts(sessions: WorkoutSession[], now: number): WorkoutSession[] {
  const seen = new Set<number>();
  return sessions.filter((session) => {
    const time = session.completedAt ? Date.parse(session.completedAt) : NaN;
    if (
      !Number.isFinite(time) ||
      time > now ||
      seen.has(session.id) ||
      !session.sets.some(isWorkingSet)
    )
      return false;
    seen.add(session.id);
    return true;
  });
}

export function weekStart(time: number): number {
  const date = new Date(time);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

export function computeConsistency(
  sessions: WorkoutSession[],
  windowDays: number,
  now: number,
  plannedDays = 4,
): number {
  const dates = new Set(
    completedWorkouts(sessions, now)
      .filter((s) => Date.parse(s.completedAt!) > now - windowDays * DAY_MS)
      .map((s) => new Date(s.completedAt!).toISOString().slice(0, 10)),
  );
  return clamp((dates.size / ((Math.max(1, Math.min(7, plannedDays)) * windowDays) / 7)) * 100);
}

export function estimated1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps <= 0) return 0;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

type Lift = keyof typeof STANDARDS.beginner.male;
export function classifyLift(name: string): Lift | null {
  const normalized = name.toLowerCase().trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (/^(barbell )?(back )?squat$/.test(normalized)) return "squat";
  if (/^(barbell )?(flat )?bench( press)?$/.test(normalized)) return "bench";
  if (/^(barbell )?(conventional )?deadlift$/.test(normalized)) return "deadlift";
  if (/^(barbell )?(standing )?(overhead press|military press|shoulder press)$/.test(normalized))
    return "overheadPress";
  return null;
}

export function computeStrength(profile: ScoreProfile, sessions: WorkoutSession[]): number {
  const tier =
    profile.experience === "advanced"
      ? "advanced"
      : profile.experience === "intermediate"
        ? "intermediate"
        : "beginner";
  const standards = STANDARDS[tier];
  const best = new Map<Lift, number>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    for (const set of session.sets.filter(isWorkingSet)) {
      const lift = classifyLift(set.exerciseName);
      const value = estimated1RM(set.weightKg ?? 0, set.reps ?? 0);
      if (lift && value > 0) best.set(lift, Math.max(best.get(lift) ?? 0, value));
    }
  }
  let total = 0;
  for (const [lift, value] of best) {
    // Unknown/invalid sex uses the midpoint, never an unchecked table index.
    const standard =
      profile.sex === "male" || profile.sex === "female"
        ? standards[profile.sex][lift]
        : (standards.male[lift] + standards.female[lift]) / 2;
    total += Math.min(1, value / standard) * 100;
  }
  return best.size ? clamp(total / best.size) : 0;
}

export function computeProgression(sessions: WorkoutSession[]): number {
  const previous = new Map<string, number>();
  let improvement = 0;
  let comparisons = 0;
  const sorted = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => Date.parse(a.completedAt!) - Date.parse(b.completedAt!) || a.id - b.id);
  for (const session of sorted) {
    const best = new Map<string, number>();
    for (const set of session.sets.filter(isWorkingSet)) {
      const key = set.exerciseId ?? set.exerciseName.trim().toLowerCase();
      const value = estimated1RM(set.weightKg ?? 0, set.reps ?? 0);
      if (value > 0) best.set(key, Math.max(best.get(key) ?? 0, value));
    }
    for (const [key, value] of best) {
      const before = previous.get(key);
      if (before) {
        // A +/-10% change spans the full scale. Regressions are not improvements.
        improvement += Math.max(-1, Math.min(1, (value / before - 1) / 0.1));
        comparisons++;
      }
      previous.set(key, value);
    }
  }
  return comparisons ? clamp(50 + (50 * improvement) / comparisons) : 0;
}

export function focusVolume(
  profile: ScoreProfile,
  sessions: WorkoutSession[],
  resolve: MuscleResolver,
): { focus: number; total: number } {
  const targets = new Set(profile.focusMuscles.map((m) => m.toLowerCase()));
  let focus = 0;
  let total = 0;
  for (const session of sessions) {
    for (const set of session.sets.filter(isWorkingSet)) {
      const volume = (set.weightKg ?? 0) * (set.reps ?? 0);
      total += volume;
      if (!set.exerciseId) continue;
      const muscles = resolve(set.exerciseId);
      if (
        [...muscles.primary, ...muscles.secondary].some((m) =>
          (TARGET_TO_FOCUS_PRIMARY[m.toLowerCase()] ?? [m.toLowerCase()]).some((group) =>
            targets.has(group),
          ),
        )
      )
        focus += volume;
    }
  }
  return { focus, total };
}

export function computeFocus(
  profile: ScoreProfile,
  sessions: WorkoutSession[],
  resolve: MuscleResolver,
  now: number,
): number {
  if (!profile.focusMuscles.length) return 0;
  const recent = completedWorkouts(sessions, now).filter(
    (s) => Date.parse(s.completedAt!) > now - CONSISTENCY_WINDOW_DAYS * DAY_MS,
  );
  const volume = focusVolume(profile, recent, resolve);
  return volume.total ? clamp((volume.focus / volume.total) * 100) : 0;
}

export function computeForgeScore(
  profile: ScoreProfile,
  sessions: WorkoutSession[],
  now: number,
  resolve: MuscleResolver = () => ({ primary: [], secondary: [] }),
): ScoreResult {
  const completed = completedWorkouts(sessions, now);
  const recent = completed.filter(
    (s) => Date.parse(s.completedAt!) > now - CONSISTENCY_WINDOW_DAYS * DAY_MS,
  );
  const pillars = {
    consistency: computeConsistency(completed, CONSISTENCY_WINDOW_DAYS, now, profile.daysPerWeek),
    strength: computeStrength(profile, recent),
    progression: computeProgression(recent),
    focus: computeFocus(profile, recent, resolve, now),
  };
  const score = clamp(
    Object.entries(pillars).reduce(
      (sum, [key, value]) => sum + value * SCORING_WEIGHTS[key as keyof typeof pillars],
      0,
    ),
  );
  const calibrated = recent.length >= MIN_SESSIONS_FOR_SCORE;
  return {
    score,
    pillars,
    calibrated,
    narrative: calibrated
      ? `Forge Score: ${score}. Based on completed working sets in the last 28 days.`
      : `Calibrating: ${recent.length}/${MIN_SESSIONS_FOR_SCORE} completed workouts in the last 28 days.`,
  };
}
