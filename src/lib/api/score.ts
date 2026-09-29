import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { loadProfileByUserId } from "./profile";
import { loadCompletedSessions } from "./sessions";
import { computeForgeScore } from "@/lib/score/compute";

export const getForgeScore = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const [profile, sessions] = await Promise.all([loadProfileByUserId(context.userId), loadCompletedSessions(context.userId)]);
  if (!profile) return { score: 0, pillars: { consistency: 0, strength: 0, progression: 0, focus: 0 }, narrative: "Complete your profile to get started.", calibrated: false };
  return computeForgeScore(profile, sessions);
});
export const getScoreHistory = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const [profile, sessions] = await Promise.all([loadProfileByUserId(context.userId), loadCompletedSessions(context.userId)]);
  if (!profile) return [];
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => {
    const end = now - (11-i) * 7 * 86_400_000;
    const monday = new Date(end);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const result = computeForgeScore(profile, sessions, end);
    return { week_start: monday.toISOString().slice(0,10), score: result.score, narrative: result.narrative };
  });
});
