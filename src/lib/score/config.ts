/**
 * Forge Score + Progress configuration
 * Weights, standards, and thresholds for the 0-100 scoring system.
 */

// Scoring pillar weights (percentages must sum to 100)
export const SCORING_WEIGHTS = {
  consistency: 0.3,
  strength: 0.3,
  progression: 0.2,
  focus: 0.2,
} as const

// Threshold for "active" status in each pillar (0-100 scale)
export const PILLAR_THRESHOLDS = {
  consistency: 20,
  strength: 20,
  progression: 10,
  focus: 15,
} as const

// Baseline standards for "strength" pillar based on experience and sex
// Values are estimated 1RM totals (kg) for a single session's volume
export const STANDARDS = {
  beginner: {
    male: {
      squat: 80,
      bench: 50,
      deadlift: 100,
      overheadPress: 40,
    },
    female: {
      squat: 60,
      bench: 40,
      deadlift: 80,
      overheadPress: 30,
    },
  },
  intermediate: {
    male: {
      squat: 140,
      bench: 90,
      deadlift: 180,
      overheadPress: 70,
    },
    female: {
      squat: 110,
      bench: 70,
      deadlift: 150,
      overheadPress: 55,
    },
  },
  advanced: {
    male: {
      squat: 200,
      bench: 130,
      deadlift: 250,
      overheadPress: 100,
    },
    female: {
      squat: 160,
      bench: 100,
      deadlift: 200,
      overheadPress: 75,
    },
  },
} as const

// Experience blending: how much the user's experience level influences
// which standard table to use. Beginner users lean more on the beginner standard,
// advanced users lean on the advanced standard.
export const EXPERIENCE_BLEND = {
  beginner: 0.8, // 80% beginner standard, 20% progression-based
  intermediate: 0.5,
  advanced: 0.2,
} as const

// Rolling window for consistency calculation (days)
export const CONSISTENCY_WINDOW_DAYS = 28

// Minimum sessions required before a score is considered valid
export const MIN_SESSIONS_FOR_SCORE = 3

// Minimum planned days per week for streak calculation
export const MIN_PLANNED_DAYS_PER_WEEK = 1

// Streak calculation: consecutive weeks with >= 60% of planned days trained
export const STREAK_PERCENTAGE_THRESHOLD = 0.6

// XP configuration
export const XP = {
  session: 50,
  pr: 25,
  prWeeklyMax: 100,
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
export const NEXT_RANK_GAP = (currentXp: number, ranks: typeof RANKS) => {
  const currentRank = ranks.find((r) => currentXp >= r.xpFloor) || ranks[0]
  const nextRank = ranks.find((r) => currentXp < r.xpFloor) || ranks[ranks.length - 1]
  return nextRank.xpFloor - currentXp
}