import type { Sql } from "../db.ts";
import { EXERCISE_CATALOG } from "./catalog.ts";
import { CATALOG_VERSION } from "./catalog-config.ts";
import { EQUIVALENT_ALIASES, CLOSEST_ALIASES, matchExercise, validateAliases } from "./match.ts";
import { normalizeName } from "./taxonomy.ts";

let seeded = false;
let seeding: Promise<void> | null = null;

/** Run on a transaction-scoped client. Never rewrite saved workouts or IDs. */
export async function seedCatalog(sql: Sql, force = false): Promise<void> {
  const meta = await sql<{
    v: string;
  }>`select value as v from catalog_meta where key = 'catalog_version' for update`;
  if (!force && meta[0]?.v === CATALOG_VERSION) return;
  validateAliases();
  const columns = [
    "id",
    "name",
    "force",
    "level",
    "mechanic",
    "equipment",
    "primary_muscles",
    "secondary_muscles",
    "instructions",
    "category",
    "image_url",
    "source",
    "search_text",
    "slug",
    "source_name",
    "canonical_id",
    "kind",
    "advanced",
    "body_part",
    "equipment_group",
    "focus_primary",
    "focus_secondary",
    "image_path",
    "catalog_version",
  ];
  const entries = [...EXERCISE_CATALOG.values()];
  for (let i = 0; i < entries.length; i += 100) {
    const values: unknown[] = [];
    const rows = entries.slice(i, i + 100).map((ex) => {
      const row = [
        ex.id,
        ex.name,
        ex.force,
        ex.level,
        ex.mechanic,
        ex.equipment,
        ex.primaryMuscles,
        ex.secondaryMuscles,
        ex.instructions,
        ex.category,
        ex.imageUrl,
        ex.source,
        ex.searchText,
        normalizeName(ex.name).replaceAll(" ", "-"),
        ex.sourceName,
        ex.canonicalId,
        ex.kind,
        ex.advanced,
        ex.bodyPart,
        ex.equipmentGroup,
        ex.focusPrimary,
        ex.focusSecondary,
        ex.imageUrl,
        CATALOG_VERSION,
      ];
      const placeholders = row.map((_, index) => `$${values.length + index + 1}`);
      values.push(...row);
      return `(${placeholders.join(",")})`;
    });
    await sql.query(
      `insert into exercises (${columns.join(",")}) values ${rows.join(",")}
      on conflict (id) do update set ${columns
        .slice(1)
        .map((c) => `${c} = excluded.${c}`)
        .join(",")}`,
      values,
    );
  }
  for (const [table, aliases] of [
    ["exercise_aliases", EQUIVALENT_ALIASES],
    ["exercise_closest_aliases", CLOSEST_ALIASES],
  ] as const) {
    for (const [key, id] of Object.entries(aliases)) {
      await sql.query(
        `insert into ${table} (alias_key, exercise_id, kind) values ($1, $2, 'strength')
        on conflict (alias_key) do update set exercise_id = excluded.exercise_id, kind = excluded.kind`,
        [normalizeName(key), id],
      );
    }
  }
  await sql`insert into catalog_meta (key, value) values ('catalog_version', ${CATALOG_VERSION})
    on conflict (key) do update set value = excluded.value`;
}

export async function syncExerciseCatalog(force = false): Promise<void> {
  if (seeding) {
    await seeding;
    if (!force) return;
  }
  if (seeded && !force) return;
  seeding = (async () => {
    const { withTransaction } = await import("../db.ts");
    await withTransaction((sql: Sql) => seedCatalog(sql, force));
    seeded = true;
  })();
  try {
    await seeding;
  } finally {
    seeding = null;
  }
}

export async function ensureExerciseCatalog(): Promise<void> {
  await syncExerciseCatalog();
}

export async function findExerciseByName(name: string) {
  const matched = matchExercise(name);
  if (!matched) return null;
  await ensureExerciseCatalog();
  const { getSql } = await import("../db.ts");
  const sql = await getSql();
  const rows = await sql<import("./library-query.ts").ExerciseRow>`
    select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
      instructions, category, image_url, source from exercises where id = ${matched.id}`;
  return rows[0] ?? null;
}
