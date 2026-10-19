import { EXERCISE_CATALOG, type Exercise } from "./catalog.ts";
import { normalizeName } from "./taxonomy.ts";

/** Equivalent names only. Do not collapse sumo/conventional or flat/incline. */
export const EQUIVALENT_ALIASES: Readonly<Record<string, string>> = {
  "barbell back squat": "Barbell_Squat",
  "bench press": "Barbell_Bench_Press_-_Medium_Grip",
  "barbell bench press": "Barbell_Bench_Press_-_Medium_Grip",
  deadlift: "Barbell_Deadlift",
  "conventional deadlift": "Barbell_Deadlift",
  "bent over row": "Bent_Over_Barbell_Row",
  "one arm dumbbell row": "One-Arm_Dumbbell_Row",
  "overhead press": "Standing_Military_Press",
  "military press": "Standing_Military_Press",
  "lateral raise": "Side_Lateral_Raise",
  "hammer curl": "Hammer_Curls",
  "dumbbell curl": "Dumbbell_Bicep_Curl",
  "air squat": "Bodyweight_Squat",
  "glute bridge": "Butt_Lift_Bridge",
};

/** Only plan generation may substitute these movements. */
export const CLOSEST_ALIASES: Readonly<Record<string, string>> = {
  "nordic curl": "Natural_Glute_Ham_Raise",
};

export function validateAliases(catalog: ReadonlyMap<string, Exercise> = EXERCISE_CATALOG): void {
  for (const aliases of [EQUIVALENT_ALIASES, CLOSEST_ALIASES]) {
    for (const [key, id] of Object.entries(aliases)) {
      const ex = catalog.get(id);
      if (!ex || ex.kind !== "strength" || ex.canonicalId !== id) {
        throw new Error(`Invalid exercise alias: ${key} -> ${id}`);
      }
      const exact = [...catalog.values()].find(
        (e) =>
          e.kind === "strength" &&
          e.canonicalId === e.id &&
          normalizeName(e.name) === normalizeName(key),
      );
      if (exact && exact.id !== id) throw new Error(`Alias overrides exact name: ${key}`);
    }
  }
}

export function matchExercise(
  query: string,
  catalog: ReadonlyMap<string, Exercise> = EXERCISE_CATALOG,
) {
  const key = normalizeName(query);
  if (!key) return null;
  // Exact names take precedence over aliases and must not be ambiguous.
  const exact = [...catalog.values()].filter(
    (e) => e.kind === "strength" && e.canonicalId === e.id && normalizeName(e.name) === key,
  );
  if (exact.length === 1)
    return { id: exact[0].id, name: exact[0].name, score: 100, method: "exact" as const };
  if (exact.length > 1) return null;
  const ex = catalog.get(EQUIVALENT_ALIASES[key]);
  return ex && ex.kind === "strength" && ex.canonicalId === ex.id
    ? { id: ex.id, name: ex.name, score: 100, method: "alias" as const }
    : null;
}

export function suggestExercise(
  query: string,
  catalog: ReadonlyMap<string, Exercise> = EXERCISE_CATALOG,
) {
  const strict = matchExercise(query, catalog);
  if (strict) return { ...strict, method: "relaxed" as const };
  const ex = catalog.get(CLOSEST_ALIASES[normalizeName(query)]);
  return ex && ex.kind === "strength" && ex.canonicalId === ex.id
    ? { id: ex.id, name: ex.name, score: 80, method: "relaxed" as const }
    : null;
}

export function exerciseFocusMuscles(
  id: string,
  catalog: ReadonlyMap<string, Exercise> = EXERCISE_CATALOG,
) {
  const ex = catalog.get(id);
  return { primary: ex?.focusPrimary ?? [], secondary: ex?.focusSecondary ?? [] };
}
