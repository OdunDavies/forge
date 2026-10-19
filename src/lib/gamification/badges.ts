import { BADGES } from "./config.ts";

export type BadgeId = keyof typeof BADGES;
export interface BadgeProgress {
  badgeId: BadgeId;
  earned: boolean;
  progress: number;
  target: number;
}
export interface BadgeFacts {
  sessionCount: number;
  prCount: number;
  bestStreak: number;
  focusWeeks: number;
  lifetimeVolume: number;
  coachTweaks: number;
  shares: number;
}

export function getBadgeProgress(facts: BadgeFacts, badgeId: BadgeId): BadgeProgress {
  const values: Record<BadgeId, [number, number]> = {
    firstSession: [facts.sessionCount, 1],
    firstPr: [facts.prCount, 1],
    tenSessions: [facts.sessionCount, 10],
    fiftySessions: [facts.sessionCount, 50],
    fourWeekStreak: [facts.bestStreak, 4],
    twelveWeekStreak: [facts.bestStreak, 12],
    focusWeek: [facts.focusWeeks, 1],
    lifetimeVolume10k: [facts.lifetimeVolume, 10000],
    firstCoachTweak: [facts.coachTweaks, 1],
    firstShare: [facts.shares, 1],
  };
  const [value, target] = values[badgeId];
  return {
    badgeId,
    earned: value >= target,
    progress: Math.max(0, Math.min(100, (value / target) * 100)),
    target,
  };
}

export const badgeProgress = getBadgeProgress;
export function hasBadge(input: BadgeFacts, badgeId: BadgeId): boolean {
  return getBadgeProgress(input, badgeId).earned;
}
export function getEarnedBadges(input: BadgeFacts): BadgeId[] {
  return (Object.keys(BADGES) as BadgeId[]).filter((id) => hasBadge(input, id));
}
