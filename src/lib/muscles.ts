export const FOCUS_MUSCLES = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core" },
  { id: "glutes", label: "Glutes" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "calves", label: "Calves" },
] as const;

export type FocusMuscleId = (typeof FOCUS_MUSCLES)[number]["id"];

export function parseTargetReps(reps: string): number | null {
  const nums = [...(reps.match(/\d+/g) ?? [])]
    .map(Number)
    .filter((n) => n > 0 && n < 80);
  return nums[0] ?? null;
}
