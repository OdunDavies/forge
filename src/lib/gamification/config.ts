/**
 * Forge Gamification configuration
 * XP values, rank thresholds, and streak calculation.
 */

// XP values for various actions
export const XP = {
  session: 50,
  pr: 25,
  prWeeklyMax: 100, // max XP from PRs per week
  focusSession: 50,
} as const

// Rank thresholds (XP required to reach each rank)
export const RANKS = [
  { name: "Ore", xpFloor: 0, color: "stone" },
  { name: "Iron", xpFloor: 400, color: "gray" },
  { name: "Steel", xpFloor: 1500, color: "primary" },
  { name: "Titanium", xpFloor: 4500, color: "amber" },
  { name: "Adamant", xpFloor: 12000, color: "rose" },
] as const

// Minimum XP gap to next rank
export function nextRankGap(currentXp: number): number {
  const nextRank = RANKS.find((r) => currentXp < r.xpFloor);
  return nextRank ? Math.max(0, nextRank.xpFloor - currentXp) : 0;
}

// Experience needed for each rank up
export const RANK_REQUIREMENTS = RANKS.map((rank) => ({
  rank: rank.name,
  xpNeeded: rank.xpFloor,
  color: rank.color,
}));

// Streak calculation: consecutive weeks with >= 60% of planned days trained
export function calculateStreak(
  trainedDaysPerWeek: number[],
  plannedDaysPerWeek: number,
): { streak: number; bestStreak: number } {
  const minDays = Math.max(1, Math.ceil(0.6 * plannedDaysPerWeek));
  let streak = 0, bestStreak = 0, run = 0;
  let current = true;
  for (const days of trainedDaysPerWeek) {
    if (days >= minDays) {
      run++;
      if (current) streak++;
      bestStreak = Math.max(bestStreak, run);
    } else { run = 0; current = false; }
  }
  return { streak, bestStreak };
}

// Badge definitions
export const BADGES = {
  firstSession: {
    id: "first_session",
    name: "First Session",
    description: "Complete your first workout session",
    icon: "dumbbell",
    category: "milestone",
  },
  firstPr: {
    id: "first_pr",
    name: "First PR",
    description: "Earn your first personal record",
    icon: "trophy",
    category: "milestone",
  },
  tenSessions: {
    id: "ten_sessions",
    name: "10 Sessions",
    description: "Complete 10 workout sessions",
    icon: "dumbbell",
    category: "milestone",
  },
  fiftySessions: {
    id: "fifty_sessions",
    name: "50 Sessions",
    description: "Complete 50 workout sessions",
    icon: "trophy",
    category: "milestone",
  },
  fourWeekStreak: {
    id: "four_week_streak",
    name: "4-Week Streak",
    description: "Maintain a streak for 4 consecutive weeks",
    icon: "calendar",
    category: "streak",
  },
  twelveWeekStreak: {
    id: "twelve_week_streak",
    name: "12-Week Streak",
    description: "Maintain a streak for 12 consecutive weeks",
    icon: "calendar",
    category: "streak",
  },
  focusWeek: {
    id: "focus_week",
    name: "Focus Week",
    description: "Complete a week where focus muscles get ≥50% of volume",
    icon: "target",
    category: "focus",
  },
  lifetimeVolume10k: {
    id: "lifetime_volume_10k",
    name: "10,000 kg Lifetime",
    description: "Lift 10,000 kg total across all sessions",
    icon: "dumbbell",
    category: "volume",
  },
  firstCoachTweak: {
    id: "first_coach_tweak",
    name: "First Coach Tweak",
    description: "Apply your first coach plan tweak",
    icon: "sparkles",
    category: "coach",
  },
  firstShare: {
    id: "first_share",
    name: "First Share",
    description: "Share your first recap card",
    icon: "share",
    category: "social",
  },
} as const