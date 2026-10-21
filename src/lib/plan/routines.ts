import type { Exercise } from "../exercises/catalog.ts";

export type Movement =
  | "squat"
  | "hinge"
  | "chest"
  | "incline"
  | "row"
  | "verticalPull"
  | "shoulders"
  | "rearDelts"
  | "biceps"
  | "triceps"
  | "calves"
  | "core"
  | "legCurl";
export interface SessionTemplate {
  title: string;
  movements: Movement[];
}

const session = (title: string, ...movements: Movement[]): SessionTemplate => ({
  title,
  movements,
});
const upperA = session("Upper A", "chest", "row", "shoulders", "verticalPull", "triceps", "biceps");
const upperB = session(
  "Upper B",
  "incline",
  "verticalPull",
  "shoulders",
  "row",
  "biceps",
  "rearDelts",
);
const lowerA = session("Lower A", "squat", "hinge", "legCurl", "calves", "core", "squat");
const lowerB = session("Lower B", "hinge", "squat", "calves", "legCurl", "core", "squat");
const pullA = session(
  "Back, Biceps & Calves A",
  "row",
  "verticalPull",
  "biceps",
  "calves",
  "rearDelts",
  "row",
);
const pullB = session(
  "Back, Biceps & Calves B",
  "verticalPull",
  "row",
  "biceps",
  "calves",
  "rearDelts",
  "verticalPull",
);
const pushA = session(
  "Chest, Shoulders & Triceps A",
  "chest",
  "shoulders",
  "triceps",
  "incline",
  "rearDelts",
  "chest",
);
const pushB = session(
  "Chest, Shoulders & Triceps B",
  "incline",
  "shoulders",
  "triceps",
  "chest",
  "rearDelts",
  "incline",
);

/** Fixed weekly adaptation: retain two leg sessions rather than requiring a rolling multiweek calendar. */
export function weeklySessions(count: number): SessionTemplate[] {
  if (count <= 3)
    return [
      session("Full Body A", "squat", "chest", "row", "hinge", "shoulders", "calves"),
      session("Full Body B", "hinge", "incline", "verticalPull", "squat", "core", "biceps"),
      session("Full Body C", "squat", "shoulders", "row", "hinge", "chest", "triceps"),
    ].slice(0, count);
  if (count === 4) return [upperA, lowerA, upperB, lowerB];
  if (count === 5) return [upperA, lowerA, pullB, pushB, lowerB];
  return [pullA, pushA, lowerA, pullB, pushB, lowerB];
}

const muscles: Record<Movement, readonly string[]> = {
  squat: ["quads", "glutes"],
  hinge: ["hamstrings", "glutes"],
  legCurl: ["hamstrings"],
  chest: ["chest"],
  incline: ["chest"],
  row: ["back"],
  verticalPull: ["back"],
  shoulders: ["shoulders"],
  rearDelts: ["shoulders", "back"],
  biceps: ["arms"],
  triceps: ["arms"],
  calves: ["calves"],
  core: ["core"],
};
const patterns: Record<Movement, RegExp> = {
  squat: /squat|leg press|lunge|step.?up/i,
  hinge: /deadlift|hip thrust|bridge|good morning/i,
  legCurl: /leg curl|hamstring curl/i,
  chest: /bench press|push.?up|pushups/i,
  incline: /incline.*press|feet.elevated.*push/i,
  row: /row/i,
  verticalPull: /pulldown|pull.down|pull.?up|pullups|chin.?up/i,
  shoulders: /shoulder press|military press|pike|lateral raise|side.*raise/i,
  rearDelts: /reverse.*fly|rear.*delt|face pull|shrug/i,
  biceps: /curl/i,
  triceps: /tricep|skull.?crusher|kickback|close.grip.*press/i,
  calves: /calf|calves/i,
  core: /plank|dead bug|crunch|bird dog/i,
};

/** Same-muscle substitutions preserve the session when a movement is unavailable or excluded. */
export function movementCandidates(pool: readonly Exercise[], movement: Movement): Exercise[] {
  return pool
    .filter(
      (ex) =>
        ex.focusPrimary.some((m) => muscles[movement].includes(m)) &&
        (movement !== "biceps" || ex.force !== "push") &&
        (movement !== "triceps" || ex.force !== "pull") &&
        (movement !== "rearDelts" || ex.force !== "push"),
    )
    .sort(
      (a, b) => Number(patterns[movement].test(b.name)) - Number(patterns[movement].test(a.name)),
    );
}

export function matchesMovement(ex: Exercise, movement: Movement) {
  return patterns[movement].test(ex.name);
}

export function prioritizeAccessories(
  template: SessionTemplate,
  focus: readonly string[],
): Movement[] {
  const movements = [...template.movements];
  // The first four slots retain the session's essential patterns. Extra slots may emphasize priorities.
  const priority = movements.filter((m) => muscles[m].some((muscle) => focus.includes(muscle)));
  if (priority.length) movements[4] = priority[0];
  return movements;
}
