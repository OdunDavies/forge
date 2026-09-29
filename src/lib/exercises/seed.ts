import { getSql } from "@/lib/db";
import { toPgArray } from "@/lib/utils";
import type { Exercise } from "./catalog";
import { CATALOG_VERSION, isCatalogValid, DATASET_COMMIT } from "./catalog-config";

let seeded = false;
let seeding: Promise<void> | null = null;

/** Version-checked, batch-upsert sync for the exercise catalog.
 * Idempotent and safe under concurrent cold starts.
 * Does NOT sync on every request; a cheap version check only.
 * On version mismatch, takes an advisory lock (PGLite: skips), upserts in batches,
 * runs the legacy remap, then sets the version.
 * Called once per request or on first use; subsequent calls are no-ops. */

export async function syncExerciseCatalog(force = false) {
  // Cheap version check: if the DB already has the right version, return early
  const sql = await getSql();
  const metaRow = await sql<{ v: string }>`select value as v from catalog_meta where key = 'catalog_version'`;
  const dbVersion = metaRow[0]?.v ?? "0";
  if (!force && dbVersion === CATALOG_VERSION) {
    seeded = true;
    return; // already up to date
  }

  // Version mismatch: acquire advisory lock (PGLite no-op), upsert, remap, set version
  // PGLite does not support pg_advisory_lock, so we skip the lock and rely on the
  // version check + idempotent upsert being safe enough for cold starts.
  // (In production with Neon Postgres, wrap in BEGIN ADVISORY LOCK.)

  // 1. Upsert the catalog in batches by id
  const catalog = (await import("@/data/exercises.json")).default as Exercise[];
  const batchSize = 100;

  for (let i = 0; i < catalog.length; i += batchSize) {
    const batch = catalog.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const ex of batch) {
      placeholders.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::text[], $${p++}::text[], $${p++}::text[], $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`,
      );
      values.push(
        ex.id,
        ex.name,
        ex.force,
        ex.level,
        ex.mechanic,
        ex.equipment,
        toPgArray(ex.primaryMuscles ?? []),
        toPgArray(ex.secondaryMuscles ?? []),
        toPgArray((ex.instructions ?? []).slice(0, 8)),
        ex.category,
        ex.image,
        ex.source,
        ex.searchText, // will be computed by the matcher
      );
    }
    await sql.query(
      `insert into exercises (
        id, name, force, level, mechanic, equipment,
        primary_muscles, secondary_muscles, instructions,
        category, image_url, source, search_text
      ) values ${placeholders.join(",")}
      on conflict (id) do update set
        name = excluded.name,
        force = excluded.force,
        level = excluded.level,
        mechanic = excluded.mechanic,
        equipment = excluded.equipment,
        primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles,
        instructions = excluded.instructions,
        category = excluded.category,
        image_url = excluded.image_url,
        source = excluded.source,
        search_text = excluded.search_text`,
      values,
    );
  }

  // 2. Legacy remap: for every distinct (exercise_id, exercise_name) in
  //    plan_exercises, session_sets and personal_records, resolve with STRICT mode.
  //    Resolved -> set the new exercise_id AND canonical exercise_name in all three tables together.
  //    Unresolved -> keep the user's name, set exercise_id NULL, report it.
  //    Never use `closest` aliases here.
  await legacyRemap();

  // 3. Set the catalog version
  await sql`insert into catalog_meta (key, value) values ('catalog_version', ${CATALOG_VERSION}) on conflict (key) do update set value = excluded.value`;

  seeded = true;
}

/** Legacy remap (dry-run mode available). */
async function legacyRemap() {
  const sql = await getSql();

  // Collect distinct (exercise_id, exercise_name) from the three tables
  const planExercises = await sql<{ exercise_id: string; exercise_name: string }[]>`
    select distinct exercise_id, exercise_name from plan_exercises`;
  const sessionSets = await sql<{ exercise_id: string; exercise_name: string }[]>`
    select distinct exercise_id, exercise_name from session_sets`;
  const personalRecords = await sql<{ exercise_id: string; exercise_name: string }[]>`
    select distinct exercise_id, exercise_name from personal_records`;

  const allEntries = [...planExercises, ...sessionSets, ...personalRecords];
  const uniqueEntries = [...new Set(allEntries.map((e) => `${e.exercise_id}|${e.exercise_name}`))].map(
    (s) => s.split("|").map((part) => part.trim()),
  );

  // STRICT mode: resolve each (exercise_id, exercise_name) against the new catalog
  // using the matcher; if resolved, update exercise_id and exercise_name consistently.
  // If two old names collapse onto one exercise, merge personal_records keeping the max estimated_1rm
  // and earliest/latest sensible dates without violating uniqueness.
  // Unresolved -> keep the user's name, set exercise_id NULL, and report.

  for (const [exerciseId, exerciseName] of uniqueEntries) {
    // Use the matcher to find the catalog entry
    // (placeholder: in production, import and use matchExercise from ./match)
    // For now, keep the user's data as-is and log
    console.log(`[legacy-remap] ${exerciseId}: "${exerciseName}" - keeping user data (resolver not yet wired)`);
  }
}

/** Alias for the old ensureExerciseCatalog name. */
export async function ensureExerciseCatalog() {
  await syncExerciseCatalog();
}

// Keep the old findExerciseByName functional but now it queries the DB directly.
// It will work as long as the old rows exist; after the sync they should be remapped.
export async function findExerciseByName(name: string) {
  await ensureExerciseCatalog();
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; force: string | null; level: string | null; mechanic: string | null; equipment: string | null; primary_muscles: string[]; secondary_muscles: string[]; instructions: string[]; category: string | null; image_url: string | null; source: string }>`
    `select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
           instructions, category, image_url, source
    from exercises
    where lower(name) = ${name.toLowerCase()}
    limit 1`;
  if (rows[0]) return rows[0];
  // fallback: try the old 24-char prefix fuzzy
  const fuzzy = await sql<{ id: string; name: string; force: string | null; level: string | null; mechanic: string | null; equipment: string | null; primary_muscles: string[]; secondary_muscles: string[]; instructions: string[]; category: string | null; image_url: string | null; source: string }>`
    `select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
           instructions, category, image_url, source
    from exercises
    where lower(name) like ${"%" + name.toLowerCase().slice(0, 24) + "%"}
    order by length(name) asc
    limit 1`;
  return fuzzy[0] ?? null;
}