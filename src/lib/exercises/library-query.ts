import type { Sql } from "../db.server.ts";
import type { DatasetRecord } from "./catalog.ts";
import type { ExerciseKind } from "./catalog-config.ts";
import { equipmentGroup } from "./catalog.ts";
import { normalizeName } from "./taxonomy.ts";

export type ExerciseRow = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  category: string | null;
  image_url: string | null;
  source: string;
};

export function mapExerciseRow(row: ExerciseRow): DatasetRecord {
  return {
    id: row.id,
    name: row.name,
    force: row.force,
    level: row.level,
    mechanic: row.mechanic,
    equipment: row.equipment,
    primaryMuscles: row.primary_muscles,
    secondaryMuscles: row.secondary_muscles,
    instructions: row.instructions,
    category: row.category,
    imageUrl: row.image_url,
    source: row.source,
  };
}

export type LibraryFilters = {
  q?: string;
  muscle?: string;
  equipment?: string;
  category?: string;
  kind?: ExerciseKind;
  limit?: number;
  offset?: number;
};

export function buildWhereClauses({ q, muscle, equipment, category, kind }: LibraryFilters) {
  const clauses = ["canonical_id = id"];
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  // Escape LIKE metacharacters so a user's percent/underscore is literal text.
  const query = q?.trim() ?? "";
  for (const token of (normalizeName(query) || query.toLowerCase()).split(/\s+/).filter(Boolean)) {
    const p = param(`%${token.replace(/[\\%_]/g, "\\$&")}%`);
    clauses.push(`(lower(name) like ${p} or lower(source_name) like ${p})`);
  }
  if (muscle?.trim()) {
    const p = param(muscle.trim().toLowerCase());
    clauses.push(`(${p} = any(primary_muscles) or ${p} = any(secondary_muscles)
      or ${p} = any(focus_primary) or ${p} = any(focus_secondary))`);
  }
  const eq =
    equipment
      ?.split(",")
      .map((e) => equipmentGroup(e))
      .filter(Boolean) ?? [];
  if (eq.length) clauses.push(`equipment_group && ${param(eq)}::text[]`);
  if (category?.trim()) clauses.push(`lower(category) = ${param(category.trim().toLowerCase())}`);
  if (kind) clauses.push(`kind = ${param(kind)}`);
  return { where: clauses.join(" and "), params };
}

const columns =
  "id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, image_url, source";

export async function queryLibrary(sql: Sql, filters: LibraryFilters) {
  const { where, params } = buildWhereClauses(filters);
  const count = await sql.query<{ c: number }>(
    `select count(*)::int as c from exercises where ${where}`,
    params,
  );
  const rows = await sql.query<ExerciseRow>(
    `select ${columns} from exercises where ${where}
    order by lower(name), id limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, filters.limit ?? 24, filters.offset ?? 0],
  );
  return { total: count[0]?.c ?? 0, items: rows.map(mapExerciseRow) };
}

export async function queryExercise(sql: Sql, id: string) {
  const rows = await sql.query<ExerciseRow>(`select ${columns} from exercises where id = $1`, [id]);
  return rows[0] ? mapExerciseRow(rows[0]) : null;
}
