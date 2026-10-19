import { FOCUS_MUSCLES } from "../muscles.ts";

// This version describes the checked-in catalog, not an external replacement.
export const CATALOG_VERSION = "0008-forge-old-shape-1";
export const CATALOG_KINDS = ["strength", "cardio", "stretch", "mobility"] as const;
export type ExerciseKind = (typeof CATALOG_KINDS)[number];

export function isCatalogValid(version = CATALOG_VERSION): boolean {
  return version === CATALOG_VERSION;
}

export function validateStrengthFocus(
  catalog: ReadonlyMap<string, { kind: ExerciseKind; name: string; focusPrimary: string[] }>,
): void {
  const valid = new Set<string>(FOCUS_MUSCLES.map((m) => m.id));
  for (const [id, ex] of catalog) {
    if (ex.kind === "strength" && !ex.focusPrimary.some((m) => valid.has(m))) {
      throw new Error(`[catalog] no mapped primary muscle for ${id} (${ex.name})`);
    }
  }
}
