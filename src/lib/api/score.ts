import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db.server";
import { computeForgeScore, DAY_MS, weekStart } from "@/lib/score/compute";
import { loadScoreData } from "@/lib/score/data.server";

export const getForgeScore = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { profile, sessions, resolve } = await loadScoreData(await getSql(), context.userId);
    return computeForgeScore(
      profile ?? { sex: null, experience: null, daysPerWeek: 4, focusMuscles: [] },
      sessions,
      Date.now(),
      resolve,
    );
  });

export const getScoreHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { profile, sessions, resolve } = await loadScoreData(await getSql(), context.userId);
    if (!profile) return [];
    const now = Date.now();
    const currentWeek = weekStart(now);
    return Array.from({ length: 12 }, (_, i) => {
      const start = currentWeek - (11 - i) * 7 * DAY_MS;
      const result = computeForgeScore(
        profile,
        sessions,
        Math.min(now, start + 7 * DAY_MS - 1),
        resolve,
      );
      return {
        week_start: new Date(start).toISOString().slice(0, 10),
        score: result.score,
        narrative: result.narrative,
      };
    });
  });
