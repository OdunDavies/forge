import type { Sql } from "../db.server.ts";
import { BADGES, RANKS, nextRankGap, rankForXp, XP } from "./config.ts";
import { getBadgeProgress, type BadgeId, type BadgeProgress } from "./badges.ts";
import { workoutFacts } from "./compute.ts";
import { computeForgeScore, focusVolume, weekStart } from "../score/compute.ts";
import { loadScoreData } from "../score/data.server.ts";

export interface ProgressionState {
  rank: (typeof RANKS)[number];
  nextRank: (typeof RANKS)[number];
  xp: number;
  xpThisWeek: number;
  xpNextRank: number;
  streak: number;
  bestStreak: number;
  badges: BadgeProgress[];
  calibrated: boolean;
}
export interface SessionRewards {
  sessionId: number;
  xpGained: number;
  rankUp: boolean;
  newRank?: (typeof RANKS)[number];
  badges: BadgeProgress[];
}

export async function loadProgression(sql: Sql, userId: string): Promise<ProgressionState> {
  const now = Date.now();
  const { profile, sessions, resolve } = await loadScoreData(sql, userId);
  const scoringProfile = profile ?? {
    sex: null,
    experience: null,
    daysPerWeek: 4,
    focusMuscles: [],
  };
  const { facts, streak, bestStreak } = workoutFacts(scoringProfile, sessions, now, resolve);
  const week = new Date(weekStart(now)).toISOString().slice(0, 10);
  const totals = await sql<{ xp: number; week_xp: number }>`select coalesce(sum(xp), 0)::int as xp,
    coalesce(sum(xp) filter (where week_start = ${week}::date), 0)::int as week_xp
    from session_rewards where user_id = ${userId}`;
  const earned = await sql<{
    badge_id: BadgeId;
  }>`select badge_id from earned_badges where user_id = ${userId}`;
  const earnedIds = new Set(earned.map((row) => row.badge_id));
  const xp = totals[0]?.xp ?? 0;
  return {
    rank: rankForXp(xp),
    nextRank: RANKS.find((rank) => rank.xpFloor > xp) ?? RANKS[RANKS.length - 1],
    xp,
    xpThisWeek: totals[0]?.week_xp ?? 0,
    xpNextRank: nextRankGap(xp),
    streak,
    bestStreak,
    badges: (Object.keys(BADGES) as BadgeId[]).map((id) => {
      const progress = getBadgeProgress(facts, id);
      return earnedIds.has(id)
        ? { ...progress, earned: true, progress: 100 }
        : { ...progress, earned: false };
    }),
    calibrated: computeForgeScore(scoringProfile, sessions, now, resolve).calibrated,
  };
}

/** Server-only entry point shared with finish; the unique ledger makes retries safe. */
export async function awardSession(
  sql: Sql,
  userId: string,
  sessionId: number,
): Promise<{ progression: ProgressionState; rewards: SessionRewards }> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${"forge-workout:" + userId}, 0))`;
  const { profile, sessions, resolve } = await loadScoreData(sql, userId);
  const session = sessions.find((workout) => workout.id === sessionId);
  if (!session) throw new Error("Completed session not found");
  const scoringProfile = profile ?? {
    sex: null,
    experience: null,
    daysPerWeek: 4,
    focusMuscles: [],
  };
  const volume = focusVolume(scoringProfile, [session], resolve);
  const focusBonus = volume.total > 0 && volume.focus / volume.total >= 0.5 ? XP.focusSession : 0;
  const rows = await sql<{ reward: { xp: number; newly_awarded: boolean } }>`
    select forge_award_session(${userId}, ${sessionId}, ${focusBonus}) as reward`;
  const reward = rows[0]!.reward;
  const { facts } = workoutFacts(scoringProfile, sessions, Date.now(), resolve);
  const newBadges: BadgeProgress[] = [];
  for (const id of Object.keys(BADGES) as BadgeId[]) {
    const progress = getBadgeProgress(facts, id);
    if (!progress.earned) continue;
    const inserted = await sql<{ badge_id: string }>`insert into earned_badges(user_id, badge_id)
      values (${userId}, ${id}) on conflict do nothing returning badge_id`;
    if (inserted.length) newBadges.push(progress);
  }
  const progression = await loadProgression(sql, userId);
  const xpGained = reward.newly_awarded ? reward.xp : 0;
  const rankUp = rankForXp(progression.xp - xpGained).xpFloor < progression.rank.xpFloor;
  return {
    progression,
    rewards: {
      sessionId,
      xpGained,
      rankUp,
      newRank: rankUp ? progression.rank : undefined,
      badges: newBadges,
    },
  };
}
