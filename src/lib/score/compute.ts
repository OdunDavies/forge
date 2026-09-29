import { STANDARDS, SCORING_WEIGHTS, CONSISTENCY_WINDOW_DAYS, MIN_SESSIONS_FOR_SCORE } from "./config.ts";
import type { Profile, WorkoutSession, SessionSet } from "../api/types.ts";
import { exerciseFocusMuscles } from "../exercises/catalog.ts";

export type ScoreResult = {
  score: number;
  pillars: Record<keyof typeof SCORING_WEIGHTS, number>;
  narrative: string;
  calibrated: boolean;
};
const DAY = 86_400_000;
const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
const working = (set: SessionSet) => set.completed && !set.isWarmup && (set.reps ?? 0) > 0;
const estimate = (set: SessionSet) => (set.weightKg ?? 0) * (1 + (set.reps ?? 0) / 30);
function recent(sessions: WorkoutSession[], days: number, now: number) {
  return sessions.filter(s => s.completedAt && Number.isFinite(Date.parse(s.startedAt)) &&
    Date.parse(s.startedAt) <= now && Date.parse(s.startedAt) >= now - days * DAY);
}
export function computeConsistency(sessions: WorkoutSession[], windowDays = CONSISTENCY_WINDOW_DAYS, now = Date.now(), plannedDays = 4) {
  const days = new Set(recent(sessions, windowDays, now).map(s => s.startedAt.slice(0, 10)));
  return clamp(days.size / (Math.max(1, plannedDays) * windowDays / 7) * 100);
}
export function computeStrength(profile: Profile, sessions: WorkoutSession[]) {
  const tier = profile.experience === "advanced" ? "advanced" : profile.experience === "beginner" ? "beginner" : "intermediate";
  const standards = STANDARDS[tier][profile.sex === "female" ? "female" : "male"];
  const best: Record<string, number> = { ...profile.baseline_lifts };
  for (const session of sessions) for (const set of session.sets.filter(working)) {
    const name = set.exerciseName.toLowerCase();
    const lift = /squat/.test(name) ? "squat" : /bench/.test(name) ? "bench" : /deadlift/.test(name) ? "deadlift" : /overhead|military|shoulder press/.test(name) ? "overheadPress" : null;
    if (lift) best[lift] = Math.max(best[lift] ?? 0, estimate(set));
  }
  const scores = Object.entries(standards).filter(([lift]) => (best[lift] ?? 0) > 0).map(([lift, standard]) => clamp(best[lift] / standard * 100));
  return scores.length ? clamp(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
}
export function computeProgression(sessions: WorkoutSession[]) {
  const previous = new Map<string, number>();
  const changes: number[] = [];
  for (const session of [...sessions].sort((a,b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))) {
    const best = new Map<string, number>();
    for (const set of session.sets.filter(working)) {
      const key = set.exerciseId ?? set.exerciseName.toLowerCase();
      best.set(key, Math.max(best.get(key) ?? 0, estimate(set)));
    }
    for (const [key, value] of best) {
      const baseline = previous.get(key);
      if (baseline && value > 0) changes.push((value / baseline - 1) * 100);
      previous.set(key, value);
    }
  }
  return changes.length ? clamp(50 + changes.reduce((a,b) => a+b, 0) / changes.length * 5) : 50;
}
export function computeFocus(profile: Profile, sessions: WorkoutSession[], resolve = exerciseFocusMuscles) {
  if (!profile.focusMuscles.length) return 50;
  let focus = 0, total = 0;
  for (const session of sessions) for (const set of session.sets.filter(working)) {
    const muscles = resolve(set.exerciseId ?? set.exerciseName);
    total++;
    if (profile.focusMuscles.some(m => muscles.primary.includes(m))) focus++;
    else if (profile.focusMuscles.some(m => muscles.secondary.includes(m))) focus += 0.5;
  }
  // The plan targets 40% of working sets toward the chosen focus muscles.
  return total ? clamp(focus / total / 0.4 * 100) : 0;
}
export function computeForgeScore(profile: Profile, sessions: WorkoutSession[], now = Date.now()): ScoreResult {
  const completed = recent(sessions, CONSISTENCY_WINDOW_DAYS, now);
  const pillars = {
    consistency: computeConsistency(completed, CONSISTENCY_WINDOW_DAYS, now, profile.daysPerWeek),
    strength: computeStrength(profile, completed),
    progression: computeProgression(completed),
    focus: computeFocus(profile, completed),
  };
  const calibrated = completed.length >= MIN_SESSIONS_FOR_SCORE;
  const score = calibrated ? clamp((Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[]).reduce((sum,key) => sum + pillars[key] * SCORING_WEIGHTS[key], 0)) : 0;
  const narrative = calibrated
    ? `Forge Score: ${score}. Based on your completed training over the last ${CONSISTENCY_WINDOW_DAYS} days.`
    : `Complete ${Math.max(0, MIN_SESSIONS_FOR_SCORE - completed.length)} more sessions to calibrate your score.`;
  return { score, pillars, calibrated, narrative };
}
