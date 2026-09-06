import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num } from "@/lib/db-map";
import { todayIso } from "@/lib/utils";

export const getTodaySummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const day = todayIso();
    const log = await sql<{
      sleep_hours: unknown;
      bodyweight_kg: unknown;
      energy: number | null;
      soreness: number | null;
      notes: string;
    }>`select sleep_hours, bodyweight_kg, energy, soreness, notes from daily_logs
       where user_id = ${context.userId} and log_date = ${day}::date limit 1`;

    const sessions = await sql<{
      volume_kg: unknown;
      set_count: number;
      pr_count: number;
      duration_sec: number | null;
      completed_at: string | null;
      title: string;
    }>`select volume_kg, set_count, pr_count, duration_sec, completed_at, title
       from workout_sessions
       where user_id = ${context.userId}
         and started_at::date = ${day}::date`;

    const week = await sql<{ volume_kg: unknown; set_count: number }>`
      select volume_kg, set_count from workout_sessions
      where user_id = ${context.userId}
        and completed_at is not null
        and completed_at >= now() - interval '7 days'`;

    const volume = sessions.reduce((a, s) => a + (num(s.volume_kg) ?? 0), 0);
    const sets = sessions.reduce((a, s) => a + (s.set_count ?? 0), 0);
    const prs = sessions.reduce((a, s) => a + (s.pr_count ?? 0), 0);
    const duration = sessions.reduce((a, s) => a + (s.duration_sec ?? 0), 0);
    const weekVolume = week.reduce((a, s) => a + (num(s.volume_kg) ?? 0), 0);
    const weekSets = week.reduce((a, s) => a + (s.set_count ?? 0), 0);

    return {
      date: day,
      log: log[0]
        ? {
            sleepHours: num(log[0].sleep_hours),
            bodyweightKg: num(log[0].bodyweight_kg),
            energy: log[0].energy,
            soreness: log[0].soreness,
            notes: log[0].notes,
          }
        : null,
      volumeKg: volume,
      setCount: sets,
      prCount: prs,
      durationSec: duration,
      sessionTitles: sessions.map((s) => s.title),
      weekVolumeKg: weekVolume,
      weekSetCount: weekSets,
    };
  });

const saveSchema = z.object({
  sleepHours: z.number().min(0).max(16).nullable().optional(),
  bodyweightKg: z.number().positive().nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  soreness: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(280).optional(),
});

export const saveDailyLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const day = todayIso();
    await sql.query(
      `insert into daily_logs (user_id, log_date, sleep_hours, bodyweight_kg, energy, soreness, notes)
       values ($1, $2::date, $3, $4, $5, $6, $7)
       on conflict (user_id, log_date) do update set
         sleep_hours = excluded.sleep_hours,
         bodyweight_kg = excluded.bodyweight_kg,
         energy = excluded.energy,
         soreness = excluded.soreness,
         notes = excluded.notes`,
      [
        context.userId,
        day,
        data.sleepHours ?? null,
        data.bodyweightKg ?? null,
        data.energy ?? null,
        data.soreness ?? null,
        data.notes ?? "",
      ],
    );
    return { ok: true };
  });
