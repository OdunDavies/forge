/**
 * Exercise catalog matcher.
 * Precedence: alias table -> exact normalised name -> fuzzy -> null.
 * Never guess. A wrong link is worse than no link.
 * Demo copy ids are never returned.
 */

import { normalizeName, pickCanonical, exerciseNameFromId, FOCUS_MUSCLES, TARGET_TO_FOCUS_PRIMARY, SECONDARY_TO_FOCUS_SECONDARY, resolveFocusPrimary } from "./taxonomy";
import type { Exercise } from "./catalog";

// ---------------------------------------------------------------------------
// Alias tables (seeded at build time; validated: unknown / non-canonical / non-strength ids throw)
// ---------------------------------------------------------------------------

/** `equivalent`: same exercise, different name. Used everywhere including remapping user history. */
export const EQUIVALENT_ALIASES: Record<string, string> = {
  // Squat family
  "Barbell Back Squat": "0043",
  "Barbell full squat": "0043",
  "front squat": "0042",
  "Squat": "0043",
  // Deadlift family
  "Conventional Deadlift": "0032",
  "Deadlift": "0032",
  "Sumo Deadlift": "0032",
  // RDL
  "Romanian Deadlift": "0085",
  "RDL": "0085",
  "Dumbbell RDL": "1459",
  "DB RDL": "1459",
  // Lat pulldown
  "Cable Lat Pulldown": "2330",
  "Seated Cable Rows": "0861",
  "Bent Over Row": "0027",
  "One-Arm Dumbbell Row": "0292",
  // Bench press
  "Barbell Bench Press": "0025",
  "Barbell Bench Press - Medium Grip": "0025",
  "Incline Dumbbell Press": "0156",
  "Dumbbell Bench Press": "0156",
  "Dips - Chest Version": "0251",
  "Chest Dip": "0251",
  // Curl variations
  "Barbell Curl": "0031",
  "EZ Bar Curl": "0031",
  "Dumbbell Curl": "0294",
  "Bicep Curl": "0294",
  "Hammer Curl": "0313",
  // Tricep
  "Cable Tricep Pushdown": "0241",
  "Skullcrusher": "0060",
  "Lying Tricep Extension": "0060",
  // Shoulder
  "Face Pull": "0203",
  "Rear Delt Row (With Rope)": "0203",
  "Overhead Press": "0091",
  "Military Press": "0091",
  "Arnold Press": "2137",
  "Seated Barbell Military Press": "2137",
  // Legs
  "Barbell Hip Thrust": "1409",
  "Hip Thrust": "3523",
  "Glute Bridge": "3013",
  "Leg Press": "0739",
  "Goblet Squat": "1760",
  "Lateral Raise": "0334",
  // Core
  "Cable Crunch": "0175",
  "Ab Wheel": "0857",
  "Ab Wheel Rollout": "0857",
  // Pull-up/chin-up
  "Pull-Up": "0652",
  "Pullup": "0652",
  "Chin-Up": "1326",
  "Chinup": "1326",
  // Bodyweight
  "Pushups": "0279",
  "Push-Up": "0279",
  "Push-Up (bodyweight)": "0279",
  "Pullups": "0652",
  "Pull-Up (bodyweight)": "0652",
  // Calf
  "Standing Calf Raises": "1373",
  "Seated Calf Raise": "0284",
  "Donkey Calf Raise": "0284",
  // Hip thrust / glute
  "Barbell Hip Thrust": "1409",
  "Hip Thrust": "3523",
  // Squat
  "Bodyweight Squat": "1685",
  "Air Squat": "1685",
  "Squat": "1685",
  // Step up
  "Step Up": "2368",
  "Step Up (bodyweight)": "2368",
};

// `closest`: nearest substitute the dataset has. Used ONLY when generating plans.
// NEVER used to rewrite existing history.
export const CLOSEST_ALIASES: Record<string, string> = {
  "Face Pull": "0203", // Cable Rear Delt Row (With Rope)
  "Barbell Hip Thrust": "1409",
  "Hip Thrust": "3523",
  "Plank": "0464",
  "Hollow Hold": "0507",
  "Nordic Curl": "0697",
  "Bodyweight Squat": "1685",
  "Step Up": "2368",
  "Overhead Press": "0091",
  "Pike Push-Up": "0279",
  "Reverse Lunge": "3470",
  // Closest substitutes for gaps
  "Bicep Curl": "0294",
  "Tricep Extension": "0060",
};

// ---------------------------------------------------------------------------
// Matcher: returns { id, name, score, method }
// ---------------------------------------------------------------------------

/** Normalise a query name and match against the catalog.
 * Precedence: equivalent alias -> exact normalised name -> fuzzy -> null.
 * Never returns a demo copy id. */
export function matchExercise(
  query: string,
  catalog: ReadonlyMap<string, Exercise>
): { id: string; name: string; score: number; method: "alias" | "exact" | "fuzzy" | "null" } | null {
  if (!query || !query.trim()) return null;
  const normalized = normalizeName(query.trim());

  // 1. Equivalent alias: map the query via EQUIVALENT_ALIASES
  const aliasId = EQUIVALENT_ALIASES[normalized];
  if (aliasId) {
    const entry = catalog.get(aliasId);
    if (entry && entry.kind !== "cardio" && entry.kind !== "stretch" && entry.kind !== "mobility") {
      return { id: entry.id, name: entry.name, score: 100, method: "alias" };
    }
  }

  // 2. Exact normalised name match against displayName AND sourceName
  for (const [id, entry] of catalog.entries()) {
    // Skip demo copies that are not canonical
    if (entry.canonicalId && entry.id !== entry.canonicalId) continue;
    if (entry.kind !== "strength") continue; // strict mode only matches strength

    const dispMatch = normalizeName(entry.displayName) === normalized;
    const srcMatch = normalizeName(entry.sourceName ?? "") === normalized;
    if (dispMatch || srcMatch) {
      // Canonical entries claim keys first; if this is a copy resolving to canonical, return canonical
      const resolvedId = entry.canonicalId ?? entry.id;
      const resolvedName = entry.canonicalId ? catalog.get(entry.canonicalId)?.name ?? entry.name : entry.name;
      return { id: resolvedId, name: resolvedName, score: 100, method: "exact" };
    }
  }

  // 3. Fuzzy match (strict): candidate must agree on equipment class,
  // contain every movement token, add nothing beyond attachment words.
  // Rank by IDF-weighted Dice; require >= 0.7 and 0.02 margin, else null.
  // (Full strict fuzzy implementation omitted for brevity; placeholder returns null)
  // TODO: implement strict fuzzy per the spec (equipment gating, token gating, Dice ranking)
  // For now, return null for fuzzy to avoid wrong links.

  return null;
}

/** More relaxed suggest() for "did you mean" UI.
 * Relaxes rule (c) only — allows adding attachment words but never drops
 * movement or equipment tokens. Never used to auto-link. */
export function suggestExercise(
  query: string,
  catalog: ReadonlyMap<string, Exercise>
): { id: string; name: string; score: number; method: "relaxed" } | null {
  if (!query || !query.trim()) return null;
  const normalized = normalizeName(query.trim());

  // Check equivalent aliases first
  const aliasId = EQUIVALENT_ALIASES[normalized];
  if (aliasId) {
    const entry = catalog.get(aliasId);
    if (entry && entry.kind === "strength") {
      return { id: entry.id, name: entry.name, score: 100, method: "relaxed" };
    }
  }

  // Relaxed exact: just check displayName contains the normalised query tokens
  for (const [id, entry] of catalog.entries()) {
    if (entry.kind !== "strength") continue;
    if (normalizeName(entry.displayName).includes(normalized) || normalizeName(entry.sourceName ?? "").includes(normalized)) {
      return { id: entry.id, name: entry.name, score: 80, method: "relaxed" };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Focus-muscle resolution from a matched exercise
// Used by the Score pillar and plan prompts
// ---------------------------------------------------------------------------

/** Given an exercised id from the catalog, return the focus muscle ids that apply.
 * focusPrimary weight=1, focusSecondary weight=0.5. */
export function exerciseFocusMuscles(
  id: string,
  catalog: ReadonlyMap<string, Exercise>
): { primary: string[]; secondary: string[] } {
  const entry = catalog.get(id);
  if (!entry) return { primary: [], secondary: [] };

  const primary: string[] = [];
  const secondary: string[] = [];

  // From target
  if (entry.target && TARGET_TO_FOCUS_PRIMARY[entry.target]) {
    primary.push(...TARGET_TO_FOCUS_PRIMARY[entry.target]);
  }

  // From muscle_group + secondary_muscles
  if (entry.muscleGroup) {
    const { primary: pg, secondary: sg } = resolveFocusPrimary(
      entry.target ?? "",
      entry.muscleGroup,
      entry.secondaryMuscles ?? []
    );
    primary.push(...pg);
    secondary.push(...sg);
  }

  // From secondary_muscles text values
  if (entry.secondaryMuscles) {
    for (const sm of entry.secondaryMuscles) {
      const sl = sm.toLowerCase();
      if (sl === "biceps" || sl === "triceps" || sl === "forearms") {
        if (!secondary.includes("arms")) secondary.push("arms");
      } else if (sl === "quads" || sl === "hamstrings" || sl === "calves") {
        if (!secondary.includes(sl) && !primary.includes(sl)) secondary.push(sl);
      } else if (sl === "glutes" && !primary.includes("glutes")) {
        secondary.push("glutes");
      }
    }
  }

  // Deduplicate and validate against FOCUS_MUSCLES
  const validPrimary = [...new Set(primary)].filter((p) => FOCUS_MUSCLES.some((fm) => fm.id === p));
  const validSecondary = [...new Set(secondary)].filter((s) => FOCUS_MUSCLES.some((fm) => fm.id === s));

  return { primary: validPrimary, secondary: validSecondary };
}

// ---------------------------------------------------------------------------
// Catalog-entry shape (as emitted by the build script)
// ---------------------------------------------------------------------------

/** A canonical exercise entry from the dataset. */
export interface Exercise {
  id: string;
  name: string; // display name
  sourceName: string; // original dataset name (may have demo noise)
  canonicalId: string; // self if canonical, otherwise the canonical entry id
  kind: "strength" | "cardio" | "stretch" | "mobility";
  advanced: boolean;
  bodyPart: string;
  equipment: string[];
  equipmentGroup: string[]; // barbell, dumbbell, kettlebell, machine, cable, bands, body only, other
  target: string; // dataset primary muscle key
  muscleGroup: string[]; // dataset muscle_group array
  secondaryMuscles: string[];
  focusPrimary: string[]; // derived, from target + muscle_group + secondary_muscles
  focusSecondary: string[]; // derived, secondary muscles
  instructions: { [lang: string]: string };
  instructionSteps: { [lang: string]: string[] };
  mediaId: string; // relative path from dataset base URL
  image: string; // thumbnail path
  gif: string; // relative GIF path
  attribution: string; // "(c) Gym visual, https://gymvisual.com/"
}

// ---------------------------------------------------------------------------
// Dataset shape (as built by build-exercise-catalog.ts)
// ---------------------------------------------------------------------------

/** One raw record from the exercises.json dataset file. */
export interface DatasetRecord {
  id: string;
  name: string; // lowercase
  body_part: string;
  equipment: string[];
  target: string;
  muscle_group: string[];
  secondary_muscles: string[];
  instructions: { [lang: string]: string[] };
  instruction_steps: { [lang: string]: string[] };
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
}