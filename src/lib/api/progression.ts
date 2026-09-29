import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { loadProfileByUserId } from "./profile";
import { loadCompletedSessions } from "./sessions";
import { XP, RANKS, nextRankGap, BADGES, calculateStreak } from "@/lib/gamification/config";
import { getBadgeProgress, type BadgeId, type BadgeProgress } from "@/lib/gamification/badges";
export interface ProgressionState {
  rank: typeof RANKS[number]; nextRank: typeof RANKS[number]; xp: number; xpThisWeek: number;
  xpNextRank: number; streak: number; bestStreak: number; badges: BadgeProgress[]; calibrated: boolean;
}
/** Derive progress from completed workouts; reading it never grants XP. */
export const getProgression = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }): Promise<ProgressionState | null> => {
  const [profile, sessions] = await Promise.all([loadProfileByUserId(context.userId), loadCompletedSessions(context.userId)]);
  if (!profile) return null;
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7); now.setUTCHours(0,0,0,0);
  const week = now.getTime();
  const trained = Array.from({length:52}, (_, i) => new Set(sessions.filter(s => {
    const date = Date.parse(s.startedAt); return date >= week - i * 604800000 && date < week + (1-i) * 604800000;
  }).map(s => s.startedAt.slice(0,10))).size);
  const xp = sessions.length * XP.session;
  const rank = [...RANKS].reverse().find(r => xp >= r.xpFloor) ?? RANKS[0];
  const nextRank = RANKS.find(r => xp < r.xpFloor) ?? RANKS[RANKS.length-1];
  const historyProfile = {...profile, trainedDaysPerWeek:trained, sessionHistory:sessions.map(s => ({id:String(s.id),volumeKg:s.volumeKg,setCount:s.setCount,durationSec:s.durationSec ?? 0,startedAt:s.startedAt}))};
  return { rank, nextRank, xp, xpThisWeek:sessions.filter(s => Date.parse(s.completedAt!) >= week).length * XP.session,
    xpNextRank:nextRankGap(xp), ...calculateStreak(trained, profile.daysPerWeek),
    badges:(Object.keys(BADGES) as BadgeId[]).map(id => getBadgeProgress(historyProfile,id)), calibrated:sessions.length >= 3 };
});
