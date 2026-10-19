import type { WorkoutSession } from "../api/types.ts";
import {
  completedWorkouts,
  DAY_MS,
  focusVolume,
  isWorkingSet,
  weekStart,
} from "../score/compute.ts";
import type { MuscleResolver, ScoreProfile } from "../score/compute.ts";
import { calculateStreak } from "./config.ts";
import type { BadgeFacts } from "./badges.ts";

export function workoutFacts(
  profile: ScoreProfile,
  history: WorkoutSession[],
  now: number,
  resolve: MuscleResolver,
) {
  const sessions = completedWorkouts(history, now);
  const weeks = new Map<number, { dates: Set<string>; sessions: WorkoutSession[] }>();
  let lifetimeVolume = 0;
  let prCount = 0;
  for (const session of sessions) {
    const start = weekStart(Date.parse(session.completedAt!));
    const week = weeks.get(start) ?? { dates: new Set<string>(), sessions: [] };
    week.dates.add(new Date(session.completedAt!).toISOString().slice(0, 10));
    week.sessions.push(session);
    weeks.set(start, week);
    for (const set of session.sets.filter(isWorkingSet)) {
      lifetimeVolume += (set.weightKg ?? 0) * (set.reps ?? 0);
      if (set.isPr) prCount++;
    }
  }
  const currentWeek = weekStart(now);
  const firstWeek = Math.min(currentWeek, ...weeks.keys());
  const trainedDaysPerWeek = Array.from(
    { length: (currentWeek - firstWeek) / (7 * DAY_MS) + 1 },
    (_, i) => weeks.get(currentWeek - i * 7 * DAY_MS)?.dates.size ?? 0,
  );
  const { streak, bestStreak } = calculateStreak(trainedDaysPerWeek, profile.daysPerWeek);
  let focusWeeks = 0;
  for (const [start, week] of weeks) {
    if (start >= currentWeek) continue;
    const volume = focusVolume(profile, week.sessions, resolve);
    if (volume.total > 0 && volume.focus / volume.total >= 0.5) focusWeeks++;
  }
  const facts: BadgeFacts = {
    sessionCount: sessions.length,
    prCount,
    bestStreak,
    focusWeeks,
    lifetimeVolume,
    coachTweaks: 0,
    shares: 0,
  };
  return { facts, streak, bestStreak };
}
