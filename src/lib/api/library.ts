import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { searchExercises as searchExercisesMatcher, type Exercise } from "@/lib/exercises/catalog";
import { getExercise as getExerciseMatcher } from "@/lib/exercises/catalog";
import { suggestExercise } from "@/lib/exercises/match";
import { asStringArray } from "@/lib/db-map";

/** Map a catalog Exercise to the UI shape. */
function mapEx(row: Exercise) {
  return {
    id: row.id,
    name: row.name,
    force: row.force,
    level: row.level,
    mechanic: row.mechanic,
    equipment: row.equipment,
    primaryMuscles: asStringArray(row.focusPrimary), // use focusPrimary as primaryMuscles
    secondaryMuscles: asStringArray(row.focusSecondary),
    instructions: Object.entries(row.instructions).length > 0
      ? Object.entries(row.instructions)[0][1]
      : [],
    category: row.bodyPart,
    imageUrl: row.image,
    source: row.sourceName,
  };
}

/** Build SQL WHERE clauses using catalog fields, NOT LIKE over a concatenated blob. */
function buildWhereClauses({
  q,
  muscle,
  equipment,
  category,
  kind,
}: {
  q?: string;
  muscle?: string;
  equipment?: string;
  category?: string;
  kind?: "strength" | "cardio" | "stretch" | "mobility";
}) {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;

  if (q) {
    // Search using display name and source name via the matcher's normalized form
    clauses.push(`lower(name) like $${i} or lower(source_name) like $${i}`);
    params.push(`%${q.toLowerCase()}%`);
    i++;
  }

  if (muscle) {
    // Use focusPrimary/focusSecondary; a muscle matches if it's in either array
    clauses.push(`$${i} = any(focus_primary) or $${i} = any(focus_secondary)`);
    params.push(muscle.toLowerCase());
    i++;
  }

  if (equipment) {
    // equipment_group is an array; check if any of the user's equipment groups overlap
    // PostgreSQL: @> means "contains"; we check if user's array is contained in equipment_group or vice versa
    // Simplified: check lower(coalesce(equipment_group, '{}')) @> lower(array[$1])
    // But we need to handle the user-provided equipment string (e.g. "barbell,dumbbell")
    const eqArr = equipment
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e);
    if (eqArr.length > 0) {
      // Check if any of the user's equipment groups match the catalog's equipment_group
      // Build a SQL condition: exists any match between user eq and catalog eq_group
      // Using a simple overlap operator:
      clauses.push(`lower(equipment_group) && lower(array[${eqArr.map((_, idx) => `$${i + idx + 1}`).join(", ")}])`);
      params.push(...eqArr);
      i += eqArr.length;
    }
  }

  if (category) {
    clauses.push(`lower(body_part) = $${i}`);
    params.push(category.toLowerCase());
    i++;
  }

  if (kind) {
    clauses.push(`kind = $${i}`);
    params.push(kind);
    i++;
  }

  const where = clauses.join(" and ");
  const countRows = await `select count(*)::int as c from exercises where ${where}`;
  const rows = await `select id, name, force, level, mechanic, equipment, equipmentGroup, focusPrimary, focusSecondary, bodyPart, target, muscleGroup, secondaryMuscles, instructions, instructionSteps, mediaId, image, gif, attribution from exercises where ${where}`;

  return { where, countRows, rows, params };
}

/** Search catalog exercises. */
export const searchExercises = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().optional(),
      muscle: z.string().optional(),
      equipment: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(60).optional(),
      offset: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { q, muscle, equipment, category, kind, limit = 24, offset = 0 } = data;

    const { rows } = await buildWhereClauses({ q, muscle, equipment, category, kind });
    const items = rows.map(mapEx);

    // If a query string was provided, additionally re-rank using the matcher for better results
    let finalItems = items;
    if (q) {
      const normalized = q.toLowerCase();
      // Simple prefix/all-tokens match on the matched items
      finalItems = items.filter(
        (item) =>
          item.name.toLowerCase().startsWith(normalized) ||
          item.name.toLowerCase().split(" ").every((t) => normalized.split(" ").includes(t)),
      );
    }

    const total = finalItems.length;
    return { total, items: finalItems.slice(offset, offset + (limit || 24)) };
  });

/** Get a single exercise by id from the catalog. */
export const getExercise = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const entry = await getExerciseMatcher(id);
    return entry ? mapEx(entry) : null;
  });

/** Catalog stats: count canonical strength entries. */
export const catalogStats = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ c: number }>`select count(*)::int as c from exercises where kind = 'strength' and canonical_id = id`;
  return { count: rows[0]?.c ?? 0 };
});