import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asNumberArray, asStringArray, num } from "@/lib/db-map";
import { parseMembership } from "@/lib/billing";
import type { Profile } from "./types";
import { slugifyHandle, toPgArray } from "@/lib/utils";

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
  sex: string | null;
  birth_year: number | null;
  height_cm: unknown;
  weight_kg: unknown;
  units: string;
  experience: string | null;
  goal: string | null;
  days_per_week: number;
  session_minutes: number;
  equipment: unknown;
  injuries: string;
  available_days: unknown;
  focus_muscles: unknown;
  onboarded_at: string | null;
  plan: string | null;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio ?? "",
    sex: row.sex,
    birthYear: num(row.birth_year),
    heightCm: num(row.height_cm),
    weightKg: num(row.weight_kg),
    units: row.units === "imperial" ? "imperial" : "metric",
    experience: row.experience,
    goal: row.goal,
    daysPerWeek: num(row.days_per_week) ?? 4,
    sessionMinutes: num(row.session_minutes) ?? 60,
    equipment: asStringArray(row.equipment),
    injuries: row.injuries ?? "",
    availableDays: asNumberArray(row.available_days),
    focusMuscles: asStringArray(row.focus_muscles),
    onboardedAt: row.onboarded_at,
    plan: parseMembership(row.plan),
  };
}

export async function loadProfileByUserId(userId: string): Promise<Profile | null> {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId} limit 1`;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadProfileByUserId(context.userId));

export const getProfileByHandle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((h: string) => h.trim().toLowerCase())
  .handler(async ({ data: handle }) => {
    const sql = await getSql();
    const rows = await sql<ProfileRow>`select * from profiles where handle = ${handle} limit 1`;
    return rows[0] ? mapProfile(rows[0]) : null;
  });

const upsertSchema = z.object({
  displayName: z.string().min(1).max(60),
  handle: z.string().min(2).max(24).optional(),
  bio: z.string().max(280).optional(),
  sex: z.string().optional(),
  birthYear: z.number().int().min(1940).max(2015).nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  experience: z.string().optional(),
  goal: z.string().optional(),
  daysPerWeek: z.number().int().min(2).max(7).optional(),
  sessionMinutes: z.number().int().min(20).max(180).optional(),
  equipment: z.array(z.string()).optional(),
  injuries: z.string().max(500).optional(),
  availableDays: z.array(z.number().int().min(0).max(6)).optional(),
  focusMuscles: z.array(z.string()).max(6).optional(),
  markOnboarded: z.boolean().optional(),
});

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<ProfileRow>`select * from profiles where user_id = ${context.userId} limit 1`;
    let handle = (data.handle ?? existing[0]?.handle ?? slugifyHandle(data.displayName))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24);
    if (!existing[0] || (data.handle && data.handle !== existing[0].handle)) {
      let candidate = handle || "athlete";
      let n = 0;
      for (;;) {
        const taken = await sql<{ user_id: string }>`
          select user_id from profiles where handle = ${candidate} and user_id <> ${context.userId} limit 1`;
        if (!taken[0]) {
          handle = candidate;
          break;
        }
        n += 1;
        candidate = `${(handle || "athlete").slice(0, 20)}${n}`;
      }
    }

    const equipment = data.equipment ?? asStringArray(existing[0]?.equipment);
    const available = data.availableDays ?? asNumberArray(existing[0]?.available_days);
    const focus = data.focusMuscles ?? asStringArray(existing[0]?.focus_muscles);
    const onboarded = data.markOnboarded
      ? new Date().toISOString()
      : existing[0]?.onboarded_at ?? null;

    await sql.query(
      `insert into profiles (
        user_id, handle, display_name, bio, sex, birth_year, height_cm, weight_kg, units,
        experience, goal, days_per_week, session_minutes, equipment, injuries, available_days,
        focus_muscles, onboarded_at, updated_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::text[],$15,$16::int[],$17::text[],$18, now()
      )
      on conflict (user_id) do update set
        handle = excluded.handle,
        display_name = excluded.display_name,
        bio = excluded.bio,
        sex = excluded.sex,
        birth_year = excluded.birth_year,
        height_cm = excluded.height_cm,
        weight_kg = excluded.weight_kg,
        units = excluded.units,
        experience = excluded.experience,
        goal = excluded.goal,
        days_per_week = excluded.days_per_week,
        session_minutes = excluded.session_minutes,
        equipment = excluded.equipment,
        injuries = excluded.injuries,
        available_days = excluded.available_days,
        focus_muscles = excluded.focus_muscles,
        onboarded_at = coalesce(profiles.onboarded_at, excluded.onboarded_at),
        updated_at = now()`,
      [
        context.userId,
        handle,
        data.displayName,
        data.bio ?? existing[0]?.bio ?? "",
        data.sex ?? existing[0]?.sex ?? null,
        data.birthYear ?? existing[0]?.birth_year ?? null,
        data.heightCm ?? num(existing[0]?.height_cm),
        data.weightKg ?? num(existing[0]?.weight_kg),
        data.units ?? existing[0]?.units ?? "metric",
        data.experience ?? existing[0]?.experience ?? null,
        data.goal ?? existing[0]?.goal ?? null,
        data.daysPerWeek ?? existing[0]?.days_per_week ?? 4,
        data.sessionMinutes ?? existing[0]?.session_minutes ?? 60,
        toPgArray(equipment),
        data.injuries ?? existing[0]?.injuries ?? "",
        `{${available.join(",")}}`,
        toPgArray(focus),
        onboarded,
      ],
    );

    const rows = await sql<ProfileRow>`select * from profiles where user_id = ${context.userId} limit 1`;
    return mapProfile(rows[0]!);
  });
