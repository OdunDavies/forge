import raw from "../../data/exercises.json" with { type: "json" };
import { normalizeName } from "./taxonomy.ts";

export type Exercise = {
  id: string; name: string; force: string | null; level: string; mechanic: string | null;
  equipment: string | null; primaryMuscles: string[]; secondaryMuscles: string[];
  instructions: string[]; category: string | null; imageUrl: string | null; source: string;
};
const focusMap: Record<string, string> = {
  abdominals: "core", abductors: "glutes", adductors: "quads", biceps: "arms",
  triceps: "arms", forearms: "arms", quadriceps: "quads", lats: "back",
  "middle back": "back", "lower back": "back", traps: "back", neck: "shoulders",
};
export const catalog: ReadonlyMap<string, Exercise> = new Map(
  (raw as Exercise[]).map((exercise) => [exercise.id, exercise]),
);
const names = new Map([...catalog.values()].map((e) => [normalizeName(e.name), e]));
export function getExercise(id: string) { return catalog.get(id) ?? null; }
export function matchExercise(query: string, entries = catalog) {
  const key = normalizeName(query);
  const entry = entries === catalog ? names.get(key) : [...entries.values()].find(e => normalizeName(e.name) === key);
  return entry ? { id: entry.id, name: entry.name, score: 100, method: "exact" as const } : null;
}
export function exerciseFocusMuscles(idOrName: string, entries = catalog) {
  const entry = entries.get(idOrName) ?? (entries === catalog ? names.get(normalizeName(idOrName)) : undefined);
  const map = (muscles: string[]) => [...new Set(muscles.map(m => focusMap[m] ?? m))];
  return { primary: map(entry?.primaryMuscles ?? []), secondary: map(entry?.secondaryMuscles ?? []) };
}
