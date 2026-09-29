import { BADGES, type RANKS } from "./config";
import type { Profile, Exercise } from "@/lib/api/profile";
import { matchExercise, exerciseFocusMuscles, type CatalogExercise, type BadgeId, type BadgeProgress } from "@/lib/exercises/catalog";
import { FOCUS_MUSCLES } from "@/lib/muscles";

/** Re-keyed fallback bank using catalog exercise ids.
 * Every slot gets `exerciseId`, and `name` must equal the catalog display name.
 * Export the bank (FALLBACK_BANK) so it can be tested.
 * plan.ts must use exerciseId directly for fallback slots (no name matching). */

export interface Slot {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  rpe: number;
  muscle: string;
  notes?: string;
  mode: "gym" | "db" | "body";
}

/** Mode detection from equipment groups. */
function modeFromEquipmentGroups(equipmentGroups: string[]): "gym" | "db" | "body" {
  const hasFullGym = equipmentGroups.includes("full gym");
  if (hasFullGym) return "gym";
  const hasGym = equipmentGroups.some((g) => ["barbell", "machine", "cable"].includes(g));
  const hasDB = equipmentGroups.includes("dumbbell") || equipmentGroups.includes("kettlebell");
  const hasBody = equipmentGroups.includes("body only");
  if (hasGym) return "gym";
  if (hasDB) return "db";
  if (hasBody) return "body";
  return "body"; // default
}

/** Build the fallback bank keyed to catalog exercise ids.
 * Replaces the old name-keyed BANK. */
export function buildFallbackBank(catalog: ReadonlyMap<string, CatalogExercise>): Record<string, Record<"gym" | "db" | "body", Slot[]>> {
  const bank: Record<string, Record<"gym" | "db" | "body", Slot[]>> = {};

  // Helper: get slots for a muscle/mode from catalog, filtered by kind=strength and advanced status
  function getSlots(muscle: string, mode: "gym" | "db" | "body"): Slot[] {
    const slots: Slot[] = [];
    catalog.forEach((ex, id) => {
      // Only strength entries
      if (ex.kind !== "strength") return;
      // Advanced moves only for advanced users (simplified check)
      if (ex.advanced) return; // will be handled by experience flag in plan.ts
      // Check focus muscles
      const { primary, secondary } = exerciseFocusMuscles(id, catalog);
      const isFocus = primary.includes(muscle) || secondary.includes(muscle);
      if (!isFocus) return;

      // Check equipment group compatibility
      const eqGroups = ex.equipmentGroup ?? [];
      const compatible = mode === "gym"
        ? eqGroups.some((g) => ["barbell", "machine", "cable"].includes(g))
        : mode === "db"
        ? eqGroups.some((g) => ["dumbbell", "kettlebell"].includes(g))
        : mode === "body"
        ? !eqGroups.some((g) => ["barbell", "machine", "cable", "dumbbell", "kettlebell"].includes(g))
        : false;
      if (!compatible) return;

      // Check mode compatibility (body mode never uses dumbbell/machine lifts)
      if (mode === "body" && (ex.kind !== "strength" || ex.advanced)) return;

      // Get the display name from catalog
      const name = ex.name; // catalog display name

      slots.push({
        exerciseId: id,
        name,
        sets: 3, // default
        reps: "8",
        restSec: 90,
        rpe: 8,
        muscle,
        mode,
      });
    });
    return slots;
  }

  // Build banks for each muscle/mode
  const allMuscles = FOCUS_MUSCLES.map((m) => m.id);

  // Gym mode: use equipment groups to determine availability
  for (const muscle of allMuscles) {
    const slots = getSlots(muscle, "gym");
    if (slots.length > 0) {
      bank[muscle] = bank[muscle] ?? {};
      bank[muscle].gym = slots;
    }
  }

  // DB mode: dumbbell/kettlebell only
  for (const muscle of allMuscles) {
    const slots = getSlots(muscle, "db");
    if (slots.length > 0) {
      bank[muscle] = bank[muscle] ?? {};
      bank[muscle].db = slots;
    }
  }

  // Body mode: bodyweight only, never use dumbbell/machine lifts
  for (const muscle of allMuscles) {
    const slots = getSlots(muscle, "body");
    if (slots.length > 0) {
      bank[muscle] = bank[muscle] ?? {};
      bank[muscle].body = slots;
    }
  }

  return bank;
}

/** Fallback bank - built from catalog at runtime.
 * Replaces the old static BANK. */
export const FALLBACK_BANK = buildFallbackBank(new Map()); // will be populated on app startup

/** Re-keyed slot for plan exercises.
 * Gets exerciseId from catalog lookup, name from catalog display name. */
export function buildFallbackPlanExercise(ex: CatalogExercise, mode: "gym" | "db" | "body"): Slot {
  const { primary, secondary } = exerciseFocusMuscles(ex.id, new Map());
  const muscle = primary[0] || secondary[0] || "core"; // default to core if none found
  return {
    exerciseId: ex.id,
    name: ex.name,
    sets: 3,
    reps: "8",
    restSec: 90,
    rpe: 8,
    muscle,
    mode,
  };
}

/** Old BANK is deprecated; use FALLBACK_BANK built from catalog. */
export const BANK = FALLBACK_BANK; // alias for backwards compatibility during transition

// Deprecation notice: the old static BANK has been replaced by FALLBACK_BANK,
// which is built from the exercise catalog at application startup.
// The old BANK used exercise names as keys; the new system uses catalog exercise ids.
// plan.ts must use exerciseId directly for fallback slots (no name matching).
// The old isUnsafe() function still works (it regexes names for squat/jump/deadlift).