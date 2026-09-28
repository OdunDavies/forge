import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getMyProfile } from "@/lib/api/profile";
import type { Profile } from "@/lib/api/profile";
import type { WorkoutSession } from "@/lib/api/sessions";
import { computeForgeScore } from "@/lib/score/compute";

export const getForgeScore = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await getMyProfile();
    if (!profile) return { score: 0, pillars: { consistency: 0, strength: 0, progression: 0, focus: 0 }, narrative: "Calibrating...", calibrated: false };

    // Get completed sessions for scoring (last 100)
    const sessionsQ = await fetch("/api/sessions?limit=100", {
      method: "GET",
      headers: { Authorization: context.session.bearerToken || "" },
    });

    if (!sessionsQ.ok) return { score: 0, pillars: { consistency: 0, strength: 0, progression: 0, focus: 0 }, narrative: "Could not fetch sessions", calibrated: false };

    const sessionsData = await sessionsQ.json();
    const sessions: WorkoutSession[] = (sessionsData?.sessions ?? [])
      .map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        plan_day_id: s.plan_day_id,
        title: s.title,
        started_at: s.started_at,
        completed_at: s.completed_at,
        duration_sec: s.duration_sec,
        bodyweight_kg: s.bodyweight_kg,
        energy: s.energy,
        soreness: s.soreness,
        notes: s.notes,
        visibility: s.visibility,
        volume_kg: s.volume_kg,
        set_count: s.set_count,
        pr_count: s.pr_count,
        photo_url: s.photo_url,
        sets: (s.sets ?? []).map((set: any) => ({
          id: set.id,
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          setIndex: set.setIndex,
          weightKg: set.weightKg,
          reps: set.reps,
          rpe: set.rpe,
          completed: set.completed,
          isWarmup: set.isWarmup,
          isPr: set.isPr,
        })),
      })) as WorkoutSession[];

    const result = computeForgeScore(profile, sessions);

    return {
      score: result.score,
      pillars: result.pillars,
      narrative: result.narrative,
      calibrated: result.calibrated,
    };
  });

export const getScoreHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await getMyProfile();
    if (!profile) return [];

    const sql = await getSql();

    // Get week start dates for the last 12 weeks
    const weeks = 12;
    const results: Array<{ week_start: string; score: number; narrative: string }> = [];

    for (let i = 0; i < weeks; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      const day = date.getDay();
      const monday = date.getDate() - (day === 0 ? 6 : day) + 1;
      const weekStart = new Date(date.getFullYear(), date.getMonth(), monday);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Count sessions in this week from the database
      const weekSessions = await sql<{ id: string; started_at: string; volume_kg: number }>`
        select id, started_at, volume_kg from workout_sessions
        where user_id = ${context.userId}
          and started_at >= ${weekStartStr + "T00:00:00"}
          and started_at < ${new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
      `;

      const sessionCount = weekSessions.length;
      // Simple score: each session contributes to consistency, basic scoring
      const consistency = sessionCount > 0 ? Math.min(100, (weekSessions.length / 4) * 25) : 0; // 4 sessions/week = 100%
      const strength = 50; // placeholder - would need lift data
      const progression = 50; // placeholder
      const focus = 50; // placeholder

      const totalScore = consistency * 0.3 + strength * 0.3 + progression * 0.2 + focus * 0.2;
      const narrative = `Forge Score: ${Math.round(totalScore)} — consistency: ${Math.round(consistency)}`;

      results.push({
        week_start: weekStartStr,
        score: Math.round(totalScore),
        narrative,
      });
    }

    // Reverse so oldest first
    return results.reverse();
  });