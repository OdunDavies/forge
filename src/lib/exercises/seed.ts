import { getSql } from "@/lib/db";
import { toPgArray } from "@/lib/utils";

type CatalogExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  imageUrl: string | null;
  source: string;
};

let seeded = false;
let seeding: Promise<void> | null = null;

export async function ensureExerciseCatalog() {
  if (seeded) return;
  if (seeding) return seeding;
  seeding = (async () => {
    const sql = await getSql();
    const rows = await sql<{ c: number }>`select count(*)::int as c from exercises`;
    if ((rows[0]?.c ?? 0) > 0) {
      seeded = true;
      return;
    }
    const catalog = (await import("@/data/exercises.json")).default as CatalogExercise[];
    const batchSize = 80;
    for (let i = 0; i < catalog.length; i += batchSize) {
      const batch = catalog.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let p = 1;
      for (const ex of batch) {
        const search = [
          ex.name,
          ex.equipment ?? "",
          ex.category ?? "",
          ...(ex.primaryMuscles ?? []),
          ...(ex.secondaryMuscles ?? []),
        ]
          .join(" ")
          .toLowerCase();
        placeholders.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::text[], $${p++}::text[], $${p++}::text[], $${p++}, $${p++}, $${p++}, $${p++})`,
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
          ex.imageUrl,
          ex.source,
          search,
        );
      }
      await sql.query(
        `insert into exercises (
          id, name, force, level, mechanic, equipment,
          primary_muscles, secondary_muscles, instructions,
          category, image_url, source, search_text
        ) values ${placeholders.join(",")}
        on conflict (id) do nothing`,
        values,
      );
    }
    seeded = true;
  })();
  try {
    await seeding;
  } finally {
    seeding = null;
  }
}

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

export async function findExerciseByName(name: string) {
  await ensureExerciseCatalog();
  const sql = await getSql();
  const rows = await sql<ExerciseRow>`
    select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
           instructions, category, image_url, source
    from exercises
    where lower(name) = ${name.toLowerCase()}
    limit 1`;
  if (rows[0]) return rows[0];
  const fuzzy = await sql<ExerciseRow>`
    select id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles,
           instructions, category, image_url, source
    from exercises
    where lower(name) like ${"%" + name.toLowerCase().slice(0, 24) + "%"}
    order by length(name) asc
    limit 1`;
  return fuzzy[0] ?? null;
}
