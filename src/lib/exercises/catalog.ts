import data from "../../data/exercises.json" with { type: "json" };
import { normalizeName, resolveFocusPrimary } from "./taxonomy.ts";
import { validateStrengthFocus, type ExerciseKind } from "./catalog-config.ts";
import type { ExerciseDemo } from "./media.ts";

/** The actual checked-in dataset and public library shape. IDs are persisted. */
export interface DatasetRecord {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  imageUrl: string | null;
  source: string;
  demo?: ExerciseDemo | null;
}

export interface Exercise extends DatasetRecord {
  displayName: string;
  sourceName: string;
  canonicalId: string;
  kind: ExerciseKind;
  advanced: boolean;
  bodyPart: string;
  equipmentGroup: string[];
  focusPrimary: string[];
  focusSecondary: string[];
  searchText: string;
}
export type CatalogExercise = Exercise;

export function equipmentGroup(equipment: string): string {
  const normalized = equipment.trim().toLowerCase();
  if (normalized === "kettlebells") return "kettlebell";
  if (normalized === "e-z curl bar") return "barbell";
  return normalized;
}

export function buildCatalog(records: readonly DatasetRecord[]): ReadonlyMap<string, Exercise> {
  const catalog = new Map<string, Exercise>();
  const canonicalKeys = new Map<string, string>();
  for (const record of records) {
    if (catalog.has(record.id)) throw new Error(`Duplicate exercise ID: ${record.id}`);
    const kind: ExerciseKind =
      record.category === "cardio"
        ? "cardio"
        : record.category === "stretching"
          ? "stretch"
          : "strength";
    const { primary, secondary } = resolveFocusPrimary(
      record.primaryMuscles[0] ?? "",
      record.primaryMuscles,
      record.secondaryMuscles,
    );
    const groups = [equipmentGroup(record.equipment ?? "body only")];
    const key = `${kind}|${groups.join(",")}|${normalizeName(record.name)}`;
    const canonicalId = canonicalKeys.get(key) ?? record.id;
    canonicalKeys.set(key, canonicalId);
    catalog.set(record.id, {
      ...record,
      displayName: record.name,
      sourceName: record.name,
      canonicalId,
      kind,
      advanced:
        record.level === "expert" ||
        ["plyometrics", "strongman", "olympic weightlifting"].includes(record.category ?? "") ||
        /jump|snatch|clean\b|muscle.?up|lever|planche|(?:one|single).arm.*(?:push|pull)|handstand|kipping|pistol/i.test(
          record.name,
        ),
      bodyPart: primary[0] ?? "other",
      equipmentGroup: groups,
      focusPrimary: primary,
      focusSecondary: secondary,
      searchText: [
        record.name,
        record.equipment,
        ...record.primaryMuscles,
        ...record.secondaryMuscles,
        ...primary,
        ...secondary,
      ]
        .join(" ")
        .toLowerCase(),
    });
  }
  validateStrengthFocus(catalog);
  return catalog;
}

export const EXERCISE_CATALOG = buildCatalog(data);
export const exerciseCatalog = EXERCISE_CATALOG;

/** Lookup preserves even noncanonical IDs so saved library links remain usable. */
export function getExercise(id: string): Exercise | null {
  return EXERCISE_CATALOG.get(id) ?? null;
}

export function searchExercises(query = ""): Exercise[] {
  const tokens = normalizeName(query).split(" ").filter(Boolean);
  return [...EXERCISE_CATALOG.values()].filter(
    (ex) =>
      ex.canonicalId === ex.id && tokens.every((t) => normalizeName(ex.searchText).includes(t)),
  );
}

export { matchExercise, suggestExercise, exerciseFocusMuscles } from "./match.ts";
