import { BADGES } from "./config"
import type { Profile } from "@/lib/api/profile"

/** Unique identifier for each badge (matches BADGES object keys). */
export type BadgeId = "firstSession" | "firstPr" | "tenSessions" | "fiftySessions" | "fourWeekStreak" | "twelveWeekStreak" | "focusWeek" | "lifetimeVolume10k" | "firstCoachTweak" | "firstShare"

/** Progress state for a single badge. */
export interface BadgeProgress {
  badgeId: BadgeId
  earned: boolean
  progress: number // 0-100 percentage
  target: number
}

/** Check if a badge has been earned. */
export function hasBadge(profile: Profile, badgeId: BadgeId): boolean {
  const badge = BADGES[badgeId]
  if (!badge) return false

  switch (badgeId) {
    case "firstSession":
      return profile.onboardedAt !== null
    case "firstPr":
      return Object.keys(profile.personalRecords ?? {}).length > 0
    case "tenSessions":
      return (profile.sessionHistory?.length ?? 0) >= 10
    case "fiftySessions":
      return (profile.sessionHistory?.length ?? 0) >= 50
    case "fourWeekStreak": {
      const trainedDays = profile.trainedDaysPerWeek ?? [0]
      const plannedDays = profile.daysPerWeek ?? 4
      const minDaysForStreak = Math.max(1, Math.ceil(0.6 * plannedDays))
      let currentStreak = 0
      let bestStreak = 0
      // Check last 4 weeks
      for (let i = 0; i < 4; i++) {
        const weekTrainedDays = trainedDays[i % trainedDays.length] || 0
        if (weekTrainedDays >= minDaysForStreak) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
      return bestStreak >= 4
    }
    case "twelveWeekStreak": {
      const trainedDays = profile.trainedDaysPerWeek ?? [0]
      const plannedDays = profile.daysPerWeek ?? 4
      const minDaysForStreak = Math.max(1, Math.ceil(0.6 * plannedDays))
      let currentStreak = 0
      let bestStreak = 0
      // Check last 12 weeks
      for (let i = 0; i < 12; i++) {
        const weekTrainedDays = trainedDays[i % trainedDays.length] || 0
        if (weekTrainedDays >= minDaysForStreak) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
      return bestStreak >= 12
    }
    case "focusWeek":
      return (profile.focusWeekHistory?.length ?? 0) > 0
    case "lifetimeVolume10k": {
      const totalVolume = (profile.sessionHistory?.reduce(
        (sum: number, s: any) => sum + (s.volumeKg ?? 0),
        0,
      ) ?? 0) >= 10000
      return totalVolume
    }
    case "firstCoachTweak":
      return (profile.tweaksApplied?.length ?? 0) > 0
    case "firstShare":
      return (profile.sharedSessions?.length ?? 0) > 0
    default:
      return false
  }
}

/** Calculate progress for a badge (0-100%). */
export function badgeProgress(
  profile: Profile,
  badgeId: BadgeId,
): BadgeProgress {
  const badge = BADGES[badgeId]
  if (!badge) return { badgeId, earned: false, progress: 0, target: 1 }

  let progress = 0
  let target = 1

  switch (badgeId) {
    case "firstSession":
      progress = profile.onboardedAt !== null ? 100 : 0
      target = 100
      break
    case "firstPr":
      const prCount = Object.keys(profile.personalRecords ?? {}).length
      progress = prCount > 0 ? 100 : 0
      target = 1
      break
    case "tenSessions":
      const sessionCount = profile.sessionHistory?.length ?? 0
      progress = Math.min(100, (sessionCount / 10) * 100)
      target = 10
      break
    case "fiftySessions":
      const fiftySessionCount = profile.sessionHistory?.length ?? 0
      progress = Math.min(100, (fiftySessionCount / 50) * 100)
      target = 50
      break
    case "fourWeekStreak": {
      const trainedDays = profile.trainedDaysPerWeek ?? [0]
      const plannedDays = profile.daysPerWeek ?? 4
      const minDaysForStreak = Math.max(1, Math.ceil(0.6 * plannedDays))
      let currentStreak = 0
      let bestStreak = 0
      for (let i = 0; i < 4; i++) {
        const weekTrainedDays = trainedDays[i % trainedDays.length] || 0
        if (weekTrainedDays >= minDaysForStreak) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
      progress = Math.min(100, (bestStreak / 4) * 100)
      target = 4
      break
    }
    case "twelveWeekStreak": {
      const trainedDays = profile.trainedDaysPerWeek ?? [0]
      const plannedDays = profile.daysPerWeek ?? 4
      const minDaysForStreak = Math.max(1, Math.ceil(0.6 * plannedDays))
      let currentStreak = 0
      let bestStreak = 0
      for (let i = 0; i < 12; i++) {
        const weekTrainedDays = trainedDays[i % trainedDays.length] || 0
        if (weekTrainedDays >= minDaysForStreak) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
      progress = Math.min(100, (bestStreak / 12) * 100)
      target = 12
      break
    }
    case "focusWeek":
      progress = Math.min(100, ((profile.focusWeekHistory?.length ?? 0) / 4) * 100)
      target = 4
      break
    case "lifetimeVolume10k": {
      const totalVolume = (profile.sessionHistory?.reduce(
        (sum: number, s: any) => sum + (s.volumeKg ?? 0),
        0,
      ) ?? 0) >= 10000
        ? 100
        : 0
      progress = totalVolume ? 100 : 0
      target = 10000
      break
    }
    case "firstCoachTweak":
      progress = 100 // placeholder
      target = 1
      break
    case "firstShare":
      progress = 100 // placeholder
      target = 1
      break
  }

  return {
    badgeId,
    earned: progress >= target,
    progress,
    target,
  }
}

/** Get all earned badges for a profile. */
export function getEarnedBadges(profile: Profile): BadgeId[] {
  const earned: BadgeId[] = []
  const allIds: BadgeId[] = [
    "firstSession",
    "firstPr",
    "tenSessions",
    "fiftySessions",
    "fourWeekStreak",
    "twelveWeekStreak",
    "focusWeek",
    "lifetimeVolume10k",
    "firstCoachTweak",
    "firstShare",
  ]

  for (const badgeId of allIds) {
    if (hasBadge(profile, badgeId)) {
      earned.push(badgeId)
    }
  }

  return earned
}

/** Get progress for a specific badge. */
export function getBadgeProgress(profile: Profile, badgeId: BadgeId): BadgeProgress {
  return badgeProgress(profile, badgeId)
}