import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { ensureExerciseCatalog, type ExerciseRow } from "@/lib/exercises/seed";
import { asStringArray } from "@/lib/db-map";

function mapEx(row: ExerciseRow) {
  return {
    id: row.id,
    name: row.name,
    force: row.force,
    level: row.level,
    mechanic: row.mechanic,
    equipment: row.equipment,
    primaryMuscles: asStringArray(row.primary_muscles),
    secondaryMuscles: asStringArray(row.secondary_muscles),
    instructions: asStringArray(row.instructions),
    category: row.category,
    imageUrl: row.image_url,
    source: row.source,
  };
}

const searchSchema = z.object({
  q: z.string().optional(),
  muscle: z.string().optional(),
  equipment: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(60).optional(),
  offset: z.number().int().min(0).optional(),
});

export const searchExercises = createServerFn({ method: "GET" })
  .validator((input: unknown) => searchSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await ensureExerciseCatalog();
    const sql = await getSql();
    const limit = data.limit ?? 24;
    const offset = data.offset ?? 0;
    const q = (data.q ?? "").trim().toLowerCase();
    const muscle = (data.muscle ?? "").trim().toLowerCase();
    const equipment = (data.equipment ?? "").trim().toLowerCase();
    const category = (data.category ?? "").trim().toLowerCase();

    const clauses: string[] = ["1=1"];
    const params: unknown[] = [];
    let i = 1;
    if (q) {
      clauses.push(`search_text like $${i++}`);
      params.push(`%${q}%`);
    }
    if (muscle) {
      clauses.push(`search_text like $${i++}`);
      params.push(`%${muscle}%`);
    }
    if (equipment) {
      clauses.push(`lower(coalesce(equipment, '')) = $${i++}`);
      params.push(equipment);
    }
    if (category) {
      clauses.push(`lower(coalesce(category, '')) = $${i++}`);
      params.push(category);
    }

    const where = clauses.join(" and ");
    const countRows = await sql.query<{ c: number }>(
      `select count(*)::int as c from exercises where ${where}`,
      params,
    );
    const rows = await sql.query<ExerciseRow>(
      `select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
              instructions, category, image_url, source
       from exercises
       where ${where}
       order by case when source = 'free-exercise-db' then 0 else 1 end, name
       limit $${i++} offset $${i++}`,
      [...params, limit, offset],
    );
    return { total: countRows[0]?.c ?? 0, items: rows.map(mapEx) };
  });

export const getExercise = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await ensureExerciseCatalog();
    const sql = await getSql();
    const rows = await sql<ExerciseRow>`
      select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
             instructions, category, image_url, source
      from exercises where id = ${id} limit 1`;
    return rows[0] ? mapEx(rows[0]) : null;
  });

export const catalogStats = createServerFn({ method: "GET" }).handler(async () => {
  await ensureExerciseCatalog();
  const sql = await getSql();
  const rows = await sql<{ c: number }>`select count(*)::int as c from exercises`;
  return { count: rows[0]?.c ?? 0 };
});
