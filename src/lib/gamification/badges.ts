import { BADGES, calculateStreak } from "./config.ts";
import type { Profile } from "../api/types.ts";
export type BadgeId = keyof typeof BADGES;
export interface BadgeProgress { badgeId: BadgeId; earned: boolean; progress: number; target: number }
export function badgeProgress(profile: Profile, badgeId: BadgeId): BadgeProgress {
  const sessions = profile.sessionHistory ?? [];
  const streak = calculateStreak(profile.trainedDaysPerWeek ?? [], profile.daysPerWeek).bestStreak;
  const metrics: Record<BadgeId, [number, number]> = {
    firstSession: [sessions.length, 1], firstPr: [Object.keys(profile.personalRecords ?? {}).length, 1],
    tenSessions: [sessions.length, 10], fiftySessions: [sessions.length, 50],
    fourWeekStreak: [streak, 4], twelveWeekStreak: [streak, 12],
    focusWeek: [profile.focusWeekHistory?.length ?? 0, 1],
    lifetimeVolume10k: [sessions.reduce((sum,s) => sum + s.volumeKg, 0), 10000],
    firstCoachTweak: [profile.tweaksApplied?.length ?? 0, 1], firstShare: [profile.sharedSessions?.length ?? 0, 1],
  };
  const [value, target] = metrics[badgeId];
  return { badgeId, target, earned: value >= target, progress: Math.min(100, Math.max(0, value / target * 100)) };
}
export const getBadgeProgress = badgeProgress;
export function hasBadge(profile: Profile, id: BadgeId) { return badgeProgress(profile,id).earned; }
export function getEarnedBadges(profile: Profile) { return (Object.keys(BADGES) as BadgeId[]).filter(id => hasBadge(profile,id)); }
