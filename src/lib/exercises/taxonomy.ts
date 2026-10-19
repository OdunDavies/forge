export { FOCUS_MUSCLES } from "../muscles.ts";

export const TARGET_TO_FOCUS_PRIMARY: Record<string, string[]> = {
  chest: ["chest"],
  pectorals: ["chest"],
  shoulders: ["shoulders"],
  delts: ["shoulders"],
  abdominals: ["core"],
  abs: ["core"],
  obliques: ["core"],
  "hip flexors": ["core"],
  "middle back": ["back"],
  "lower back": ["back"],
  "upper back": ["back"],
  upper_back: ["back"],
  lats: ["back"],
  traps: ["back"],
  spine: ["back"],
  neck: ["back"],
  biceps: ["arms"],
  triceps: ["arms"],
  forearms: ["arms"],
  quadriceps: ["quads"],
  quads: ["quads"],
  adductors: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  abductors: ["glutes"],
  hips: ["glutes"],
  calves: ["calves"],
  cardiovascular: [],
};
export const SECONDARY_TO_FOCUS_SECONDARY = TARGET_TO_FOCUS_PRIMARY;

export function resolveFocusPrimary(
  target: string,
  muscleGroup: readonly string[],
  secondaryMuscles: readonly string[],
): { primary: string[]; secondary: string[] } {
  const map = (muscles: readonly string[]) => [
    ...new Set(muscles.flatMap((m) => TARGET_TO_FOCUS_PRIMARY[m.toLowerCase()] ?? [])),
  ];
  const primary = map(muscleGroup.length ? muscleGroup : [target]);
  return { primary, secondary: map(secondaryMuscles).filter((m) => !primary.includes(m)) };
}

/** Normalize spelling, not movement variations or equipment distinctions. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\((?:male|female|back pov|side pov)\)/g, " ")
    .replace(/\bv\.\s*\d+(?:\/\d+)?$/g, " ")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/\bkb\b/g, "kettlebell")
    .replace(/\brdl\b/g, "romanian deadlift")
    .replace(/\bohp\b/g, "overhead press")
    .replace(/\b(push|pull|chin|sit)[ -]?ups?\b/g, "$1 up")
    .replace(/\bbicep\b/g, "biceps")
    .replace(/\btricep\b/g, "triceps")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function pickCanonical(
  ids: string[],
  nameFromId: (id: string) => string | undefined = (id) => id,
): [string, ...string[]] {
  if (!ids.length) throw new Error("Cannot canonicalize an empty exercise group");
  return [...ids].sort((a, b) => {
    const noise = /\((?:male|female|back pov|side pov)\)|\bv\.\s*\d/i;
    return (
      Number(noise.test(nameFromId(a) ?? "")) - Number(noise.test(nameFromId(b) ?? "")) ||
      a.localeCompare(b)
    );
  }) as [string, ...string[]];
}
