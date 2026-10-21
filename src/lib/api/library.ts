import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db.server";
import { ensureExerciseCatalog } from "@/lib/exercises/seed";
import { queryLibrary, queryExercise } from "@/lib/exercises/library-query";
import { CATALOG_KINDS } from "@/lib/exercises/catalog-config";

export type { DatasetRecord as Exercise } from "@/lib/exercises/catalog";

export const searchExercises = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(200).optional(),
        muscle: z.string().optional(),
        equipment: z.string().optional(),
        category: z.string().optional(),
        kind: z.enum(CATALOG_KINDS).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        withVideo: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await ensureExerciseCatalog();
    return queryLibrary(await getSql(), data);
  });

export const getExercise = createServerFn({ method: "GET" })
  .validator((id: unknown) => z.string().min(1).parse(id))
  .handler(async ({ data: id }) => {
    await ensureExerciseCatalog();
    return queryExercise(await getSql(), id);
  });

export const catalogStats = createServerFn({ method: "GET" }).handler(async () => {
  await ensureExerciseCatalog();
  const sql = await getSql();
  const rows = await sql<{
    c: number;
  }>`select count(*)::int as c from exercises where kind = 'strength' and canonical_id = id`;
  return { count: rows[0]?.c ?? 0 };
});
