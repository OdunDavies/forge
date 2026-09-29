import { FOCUS_MUSCLES } from "../muscles.ts";
export { FOCUS_MUSCLES };
/**
 * Exercise dataset taxonomy: maps dataset fields to Forge schema.
 * Pure, dependency-free. Uses only relative imports with .ts extensions.
 */

// Map dataset `target` (primary muscle) to Forge focusPrimary set
// Fail the build on any unmapped target value (see catalog-config.ts)
export const TARGET_TO_FOCUS_PRIMARY: Record<string, string[]> = {
  chest: ["chest"],
  pectorals: ["chest"],
  delts: ["shoulders"],
  shoulders: ["shoulders"],
  abs: ["core"],
  spine: ["back"],
  upper_back: ["back"],
  lats: ["back"],
  traps: ["back"],
  levator_scapulae: ["back"],
  biceps: ["arms"],
  triceps: ["arms"],
  forearms: ["arms"],
  quadriceps: ["quads"],
  adductors: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
  serratus: ["chest"],
  cardiovascular: [],
};

// Map dataset `muscle_group` + `secondary_muscles` to Forge focusSecondary
// A "secondaries" table: muscle_group value -> Forge focusSecondary id(s)
export const SECONDARY_TO_FOCUS_SECONDARY: Record<string, string[]> = {
  // No explicit mapping needed; secondary_muscles values are resolved inline
};

// Compound rule: if an exercise targets glutes AND muscle_group includes quads,
// also mark quads as primary; if muscle_group includes hamstrings, also mark hamstrings primary
// plus back for deadlift/good morning/back extension names
export function resolveFocusPrimary(
  target: string,
  muscleGroup: readonly string[],
  secondaryMuscles: readonly string[]
): { primary: string[]; secondary: string[] } {
  const primary: string[] = [...(TARGET_TO_FOCUS_PRIMARY[target] ?? [])];
  const secondary: string[] = [];

  // Add secondary from muscle_group
  for (const mg of muscleGroup) {
    const mapped = SECONDARY_TO_FOCUS_SECONDARY[mg];
    if (mapped) secondary.push(...mapped);
  }

  // Add secondary from secondary_muscles text values
  for (const sm of secondaryMuscles) {
    // quick lookup by known names
    const smLower = sm.toLowerCase();
    if (smLower === "biceps" || smLower === "triceps" || smLower === "forearms") {
      if (!secondary.includes("arms")) secondary.push("arms");
    } else if (smLower === "quads" || smLower === "hamstrings" || smLower === "calves") {
      if (!secondary.includes(smLower) && !primary.includes(smLower)) secondary.push(smLower);
    } else if (smLower === "glutes" && !primary.includes("glutes")) {
      secondary.push("glutes");
    }
  }

  // Compound: target glutes + muscle_group quads -> also primary quads
  if (primary.includes("glutes") && muscleGroup.some((g) => g.toLowerCase().includes("quad"))) {
    if (!primary.includes("quads")) primary.push("quads");
  }
  // Compound: target glutes + muscle_group hamstrings -> also primary hamstrings, plus back for deadlift names
  if (primary.includes("glutes") && muscleGroup.some((g) => g.toLowerCase().includes("ham"))) {
    if (!primary.includes("hamstrings")) primary.push("hamstrings");
    if (!secondary.includes("back")) secondary.push("back");
  }

  // Deduplicate
  return {
    primary: [...new Set(primary)].filter((p) => FOCUS_MUSCLES.some((fm) => fm.id === p)),
    secondary: [...new Set(secondary)].filter((s) => FOCUS_MUSCLES.some((fm) => fm.id === s)),
  };
}

// Canonical deduplication: given a list of dataset ids that normalize to the same key,
// pick one canonical (prefer no demo noise, then lowest id) and set canonicalId on the rest.
// Returns [canonicalId, ...copyIds]
export function pickCanonical(ids: string[]): [string, ...string[]] {
  // Sort: prefer ids without demo noise "(male)", "(female)", "(back pov)", "(side pov)", " v. 2/3", duplicate names
  const demoNoise = /^\((male|female|back pov|side pov)\)$/i;
  const verRegex = / v\. \d\/\d$/;

  const scored = ids.map((id) => {
    const name = exerciseNameFromId(id); // will be provided by caller
    const hasDemo = demoNoise.test(name ?? "");
    const hasVer = verRegex.test(name ?? "");
    return { id, score: hasDemo || hasVer ? 2 : 1, demo: hasDemo, ver: hasVer };
  });
  // Sort: lowest score first (1 > 2), then by id string for determinism
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.id.localeCompare(b.id);
  });
  const canonical = scored[0].id;
  const copies = scored.slice(1).map((s) => s.id);
  return [canonical, ...copies];
}

// Exercise name lookup by id - provided by catalog builder
export const exerciseNameFromId = (id: string): string => id.replaceAll("_", " ");

/** Normalise an exercise name for matching: lowercase, strip demo noise, collapse compounds, etc. */
export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = raw.toLowerCase();

  // Strip demo noise: (male), (female), (back pov), (side pov), " v. 2/3"
  s = s.replace(/\((male|female|back pov|side pov)\)/i, "").trim();
  s = s.replace(/ v\. \d[/\d]*$/, "").trim();

  // Hyphens/punctuation to spaces
  s = s.replace(/[-_]/g, " ");

  // Apply typo table
  const TYPO_TABLE: Record<string, string> = {
    mojibake: "45°", // handled separately
    sitted: "seated",
    depresor: "depressor",
    squad: "quad",
    keens: "knees",
    peacher: "preacher",
    revers: "reverse",
    rollerout: "rollout",
    rollerer: "roller",
    "side bent": "side bend",
    "bicep": "biceps",
    "tricep": "triceps",
  };
  for (const [typos, correction] of Object.entries(TYPO_TABLE)) {
    // word-boundary replacement
    const regex = new RegExp(`\\b${typos}\\b`, "i");
    s = s.replace(regex, correction);
  }

  // Expand abbreviations
  s = s.replace(/\bez\b/gi, "ez ");
  s = s.replace(/\bsz\b/gi, "ez ");

  // Drop "medium grip"
  s = s.replace(/medium\\s*grip/gi, "").trim();

  // Collapse compounds: push up/pushup/push-ups -> push-up
  // (This is a partial list; full set in the matcher)
  const COMPOUNDS: Record<string, string> = {
    pushups: "push-up",
    pushup: "push-up",
    "push-ups": "push-up",
    pullups: "pull-up",
    pullup: "pull-up",
    "pull-ups": "pull-up",
    chinups: "chin-up",
    chinup: "chin-up",
    "chin-ups": "chin-up",
    situps: "sit-up",
    situp: "sit-up",
    "sit-ups": "sit-up",
    pulldowns: "pulldown",
    pulldown: "pulldown",
    pushdowns: "pushdown",
    pushdown: "pushdown",
    pullover: "pullover",
    skullcrushers: "skullcrusher",
    skullcrusher: "skullcrusher",
    bodyweight: "body weight",
    "air squat": "bodyweight squat",
    "squat (bodyweight)": "bodyweight squat",
    "single leg squat": "single leg squat (pistol) male", // keep as-is, handled by demo strip
    "single leg squat (pistol) male": "single leg squat (pistol)",
    "step-up": "step up",
    stepup: "step up",
    "Romanian Deadlift": "RDL",
    RDL: "RDL",
    "overhead press": "overhead press",
    OHP: "overhead press",
    "military press": "overhead press",
    "dumbbell curl": "dumbbell curl",
    "bicep curl": "dumbbell curl",
    "tricep extension": "tricep extension",
    "hammer curl": "hammer curl",
  };
  for (const [key, val] of Object.entries(COMPOUNDS)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    s = s.replace(regex, val);
  }

  // Expand RDL, OHP, DB/BB/KB
  s = s.replace(/\brdl\b/gi, "RDL");
  s = s.replace(/\boverhead press\b/gi, "overhead press");
  s = s.replace(/\bOHP\b/gi, "overhead press");
  s = s.replace(/\bdeadlift\b/gi, "deadlift");
  s = s.replace(/\bgood morning\b/gi, "good morning");

  // Singularise plurals (simplified)
  s = s.replace(/s$/, ""); // naive - final pass will be stricter

  // Collapse repeated tokens (e.g. "Romanian Deadlift (RDL)" -> "Romanian Deadlift")
  // Remove parenthetical demo suffixes
  s = s.replace(/\\s*\\((male|female|back pov|side pov|RDL|RDL)\\)\\s*$/i, "").trim();

  return s;
}