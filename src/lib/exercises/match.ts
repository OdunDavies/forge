import { catalog, matchExercise, exerciseFocusMuscles, type Exercise } from "./catalog.ts";
import { normalizeName } from "./taxonomy.ts";
export { matchExercise, exerciseFocusMuscles };
export type { Exercise };
/** Suggestions never rewrite history or silently replace a movement. */
export function suggestExercise(query: string, entries: ReadonlyMap<string, Exercise> = catalog) {
  const exact = matchExercise(query, entries);
  if (exact) return { ...exact, method: "relaxed" as const };
  const tokens = normalizeName(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const candidates = [...entries.values()].filter(e => e.category === "strength" && tokens.every(t => normalizeName(e.name).split(/\s+/).includes(t)));
  if (candidates.length !== 1) return null;
  return { id: candidates[0].id, name: candidates[0].name, score: 80, method: "relaxed" as const };
}
