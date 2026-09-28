import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getMyProfile } from "@/lib/api/profile";
import type { Profile } from "@/lib/api/profile";
import { XP, RANKS, nextRankGap, BADGES } from "@/lib/gamification/config";
import { getEarnedBadges, getBadgeProgress, BadgeId, BadgeProgress } from "@/lib/gamification/badges";
import { computeForgeScore } from "@/lib/score/compute";

export interface ProgressionState {
  rank: typeof RANKS[number];
  nextRank: typeof RANKS[number];
  xp: number;
  xpThisWeek: number;
  xpNextRank: number;
  streak: number;
  bestStreak: number;
  badges: BadgeProgress[];
  calibrated: boolean;
}

export interface SessionRewards {
  sessionId: string;
  xpGained: number;
  rankUp: boolean;
  newRank?: typeof RANKS[number];
  badges: BadgeProgress[];
}

export const awardForSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await getMyProfile();
    if (!profile) return { progression: null, rewards: null };

    // Calculate XP gains
    let xpGained = XP.session; // base session XP

    // Check for focus session bonus
    if (profile.focusMuscles?.length > 0) {
      xpGained += XP.focusSession;
    }

    const totalXp = (profile.xp ?? 0) + xpGained;
    const xpThisWeek = (profile.xpThisWeek ?? 0) + xpGained;

    // Determine rank
    const currentRank = RANKS.find((r) => totalXp >= r.xpFloor) || RANKS[0];
    const nextRank = RANKS.find((r) => totalXp < r.xpFloor) || RANKS[RANKS.length - 1];
    const xpNextRank = nextRankGap(totalXp);

    // Calculate streak
    const { streak, bestStreak } = {
      streak: 0,
      bestStreak: 0,
    }; // simplified - would need trainedDaysPerWeek from profile

    // Check for badges
    const earnedBadges = getEarnedBadges(profile);
    const badgeProgressList = Object.keys(BADGES).reduce<
      BadgeProgress[]
    >((acc, badgeKey) => {
      const badgeId = badgeKey as BadgeId;
      const progress = getBadgeProgress(profile, badgeId);
      if (progress.earned && !earnedBadges.includes(badgeId)) {
        acc.push(progress);
      }
      return acc;
    }, [] as BadgeProgress[]);

    const progression: ProgressionState = {
      rank: currentRank,
      nextRank,
      xp: totalXp,
      xpThisWeek,
      xpNextRank,
      streak,
      bestStreak,
      badges: badgeProgressList,
      calibrated: false,
    };

    const rewards: SessionRewards = {
      sessionId: "",
      xpGained,
      rankUp: currentRank.xpFloor !== nextRank.xpFloor,
      newRank: currentRank.xpFloor !== nextRank.xpFloor ? nextRank : undefined,
      badges: badgeProgressList,
    };

    return { progression, rewards };
  });

export const getProgression = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const progression = await awardForSession({ context } as any);
    return progression.progression;
  });