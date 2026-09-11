type Slot = {
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  rpe: number;
  muscle: string;
  notes?: string;
};

type Mode = "gym" | "db" | "body";

const BANK: Record<string, Record<Mode, Slot[]>> = {
  chest: {
    gym: [
      { name: "Barbell Bench Press - Medium Grip", sets: 4, reps: "6-8", restSec: 180, rpe: 8, muscle: "chest" },
      { name: "Incline Dumbbell Press", sets: 3, reps: "8-10", restSec: 120, rpe: 8, muscle: "chest" },
      { name: "Dips - Chest Version", sets: 3, reps: "8-12", restSec: 90, rpe: 8, muscle: "chest" },
      { name: "Cable Crossover", sets: 3, reps: "10-15", restSec: 75, rpe: 7.5, muscle: "chest" },
    ],
    db: [
      { name: "Dumbbell Bench Press", sets: 4, reps: "8-10", restSec: 120, rpe: 8, muscle: "chest" },
      { name: "Incline Dumbbell Press", sets: 3, reps: "8-12", restSec: 90, rpe: 8, muscle: "chest" },
      { name: "Incline Dumbbell Flyes", sets: 3, reps: "10-12", restSec: 75, rpe: 7.5, muscle: "chest" },
      { name: "Dumbbell Pullover", sets: 2, reps: "10-12", restSec: 75, rpe: 7, muscle: "chest" },
    ],
    body: [
      { name: "Pushups", sets: 4, reps: "8-20", restSec: 90, rpe: 8, muscle: "chest" },
      { name: "Archer Push-Up", sets: 3, reps: "6-10", restSec: 90, rpe: 8, muscle: "chest" },
      { name: "Diamond Push-Up", sets: 3, reps: "8-12", restSec: 75, rpe: 8, muscle: "chest" },
      { name: "Wide Push-Up", sets: 3, reps: "10-15", restSec: 60, rpe: 7.5, muscle: "chest" },
    ],
  },
  back: {
    gym: [
      { name: "Bent Over Barbell Row", sets: 4, reps: "6-8", restSec: 150, rpe: 8, muscle: "back" },
      { name: "Wide-Grip Lat Pulldown", sets: 3, reps: "8-12", restSec: 90, rpe: 8, muscle: "back" },
      { name: "Seated Cable Rows", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5, muscle: "back" },
      { name: "Straight-Arm Pulldown", sets: 3, reps: "10-15", restSec: 75, rpe: 7.5, muscle: "back" },
    ],
    db: [
      { name: "Dumbbell One-Arm Row", sets: 4, reps: "8-10", restSec: 90, rpe: 8, muscle: "back" },
      { name: "Chest-Supported Dumbbell Row", sets: 3, reps: "8-12", restSec: 90, rpe: 8, muscle: "back" },
      { name: "Dumbbell Pullover", sets: 3, reps: "10-12", restSec: 75, rpe: 7.5, muscle: "back" },
      { name: "Reverse Flyes", sets: 3, reps: "12-15", restSec: 60, rpe: 7, muscle: "back" },
    ],
    body: [
      { name: "Pullups", sets: 4, reps: "5-10", restSec: 120, rpe: 8, muscle: "back" },
      { name: "Inverted Row", sets: 4, reps: "8-12", restSec: 90, rpe: 8, muscle: "back" },
      { name: "Superman", sets: 3, reps: "10-15", restSec: 60, rpe: 7.5, muscle: "back" },
      { name: "Prone Y Raise", sets: 3, reps: "10-15", restSec: 60, rpe: 7, muscle: "back" },
    ],
  },
  shoulders: {
    gym: [
      { name: "Seated Barbell Military Press", sets: 4, reps: "6-10", restSec: 150, rpe: 8, muscle: "shoulders" },
      { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-15", restSec: 60, rpe: 8, muscle: "shoulders" },
      { name: "Face Pull", sets: 3, reps: "12-15", restSec: 60, rpe: 7.5, muscle: "shoulders" },
      { name: "Arnold Press", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5, muscle: "shoulders" },
    ],
    db: [
      { name: "Dumbbell Shoulder Press", sets: 4, reps: "8-12", restSec: 90, rpe: 8, muscle: "shoulders" },
      { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-15", restSec: 60, rpe: 8, muscle: "shoulders" },
      { name: "Rear Delt Fly", sets: 3, reps: "12-15", restSec: 60, rpe: 7.5, muscle: "shoulders" },
      { name: "Arnold Press", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5, muscle: "shoulders" },
    ],
    body: [
      { name: "Pike Push-Up", sets: 4, reps: "6-12", restSec: 90, rpe: 8, muscle: "shoulders" },
      { name: "Handstand Hold", sets: 3, reps: "20-40s", restSec: 90, rpe: 8, muscle: "shoulders" },
      { name: "Pseudo Planche Push-Up", sets: 3, reps: "6-10", restSec: 90, rpe: 8, muscle: "shoulders" },
      { name: "Prone Y Raise", sets: 3, reps: "10-15", restSec: 60, rpe: 7, muscle: "shoulders" },
    ],
  },
  arms: {
    gym: [
      { name: "Close-Grip Barbell Bench Press", sets: 3, reps: "6-10", restSec: 120, rpe: 8, muscle: "arms" },
      { name: "Barbell Curl", sets: 3, reps: "8-12", restSec: 75, rpe: 8, muscle: "arms" },
      { name: "Cable Tricep Pushdown", sets: 3, reps: "10-12", restSec: 60, rpe: 7.5, muscle: "arms" },
      { name: "Incline Dumbbell Curl", sets: 3, reps: "10-12", restSec: 60, rpe: 7.5, muscle: "arms" },
    ],
    db: [
      { name: "Dumbbell Bicep Curl", sets: 3, reps: "8-12", restSec: 60, rpe: 8, muscle: "arms" },
      { name: "Dumbbell Skullcrusher", sets: 3, reps: "8-12", restSec: 75, rpe: 8, muscle: "arms" },
      { name: "Hammer Curl", sets: 3, reps: "10-12", restSec: 60, rpe: 7.5, muscle: "arms" },
      { name: "Overhead Dumbbell Extension", sets: 3, reps: "10-12", restSec: 60, rpe: 7.5, muscle: "arms" },
    ],
    body: [
      { name: "Diamond Push-Up", sets: 3, reps: "8-15", restSec: 75, rpe: 8, muscle: "arms" },
      { name: "Chin-Up", sets: 3, reps: "5-10", restSec: 120, rpe: 8, muscle: "arms" },
      { name: "Bench Dip", sets: 3, reps: "8-15", restSec: 60, rpe: 7.5, muscle: "arms" },
      { name: "Bodyweight Curl", sets: 3, reps: "8-12", restSec: 60, rpe: 7, muscle: "arms" },
    ],
  },
  core: {
    gym: [
      { name: "Hanging Leg Raise", sets: 3, reps: "8-12", restSec: 60, rpe: 8, muscle: "core" },
      { name: "Cable Crunch", sets: 3, reps: "10-15", restSec: 60, rpe: 8, muscle: "core" },
      { name: "Ab Wheel Rollout", sets: 3, reps: "8-12", restSec: 75, rpe: 8, muscle: "core" },
      { name: "Pallof Press", sets: 3, reps: "8-12", restSec: 60, rpe: 7.5, muscle: "core" },
    ],
    db: [
      { name: "Dumbbell Side Bend", sets: 3, reps: "10-12", restSec: 45, rpe: 7.5, muscle: "core" },
      { name: "Weighted Sit-Up", sets: 3, reps: "10-15", restSec: 60, rpe: 8, muscle: "core" },
      { name: "Dumbbell Dead Bug", sets: 3, reps: "8-12", restSec: 45, rpe: 7, muscle: "core" },
      { name: "Plank", sets: 3, reps: "30-45s", restSec: 60, rpe: 8, muscle: "core" },
    ],
    body: [
      { name: "Hanging Leg Raise", sets: 3, reps: "8-12", restSec: 60, rpe: 8, muscle: "core" },
      { name: "Plank", sets: 3, reps: "30-45s", restSec: 60, rpe: 8, muscle: "core" },
      { name: "Dead Bug", sets: 3, reps: "8-12", restSec: 45, rpe: 7.5, muscle: "core" },
      { name: "Hollow Hold", sets: 3, reps: "20-40s", restSec: 45, rpe: 8, muscle: "core" },
    ],
  },
  glutes: {
    gym: [
      { name: "Barbell Hip Thrust", sets: 4, reps: "6-10", restSec: 120, rpe: 8, muscle: "glutes" },
      { name: "Romanian Deadlift", sets: 3, reps: "6-8", restSec: 150, rpe: 8, muscle: "glutes" },
      { name: "Bulgarian Split Squat", sets: 3, reps: "8-10", restSec: 90, rpe: 8, muscle: "glutes" },
      { name: "Cable Pull Through", sets: 3, reps: "10-15", restSec: 75, rpe: 7.5, muscle: "glutes" },
    ],
    db: [
      { name: "Dumbbell Hip Thrust", sets: 4, reps: "8-12", restSec: 90, rpe: 8, muscle: "glutes" },
      { name: "Dumbbell RDL", sets: 3, reps: "8-10", restSec: 120, rpe: 8, muscle: "glutes" },
      { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "8-10", restSec: 90, rpe: 8, muscle: "glutes" },
      { name: "Glute Bridge", sets: 3, reps: "10-15", restSec: 60, rpe: 7.5, muscle: "glutes" },
    ],
    body: [
      { name: "Hip Thrust", sets: 4, reps: "10-15", restSec: 75, rpe: 8, muscle: "glutes" },
      { name: "Single-Leg Glute Bridge", sets: 3, reps: "8-12", restSec: 60, rpe: 8, muscle: "glutes" },
      { name: "Reverse Lunge", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5, muscle: "glutes" },
      { name: "Frog Pump", sets: 3, reps: "15-20", restSec: 45, rpe: 7.5, muscle: "glutes" },
    ],
  },
  quads: {
    gym: [
      { name: "Barbell Squat", sets: 4, reps: "5-8", restSec: 180, rpe: 8, muscle: "quads" },
      { name: "Front Barbell Squat", sets: 3, reps: "6-10", restSec: 150, rpe: 8, muscle: "quads" },
      { name: "Leg Press", sets: 3, reps: "8-12", restSec: 120, rpe: 7.5, muscle: "quads" },
      { name: "Walking Lunge", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5, muscle: "quads" },
    ],
    db: [
      { name: "Dumbbell Goblet Squat", sets: 4, reps: "8-12", restSec: 120, rpe: 8, muscle: "quads" },
      { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "8-10", restSec: 90, rpe: 8, muscle: "quads" },
      { name: "Dumbbell Walking Lunge", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5, muscle: "quads" },
      { name: "Heels-Elevated Goblet Squat", sets: 3, reps: "10-12", restSec: 75, rpe: 7.5, muscle: "quads" },
    ],
    body: [
      { name: "Bodyweight Squat", sets: 4, reps: "12-20", restSec: 90, rpe: 8, muscle: "quads" },
      { name: "Walking Lunge", sets: 3, reps: "10-14", restSec: 75, rpe: 8, muscle: "quads" },
      { name: "Pistol Squat", sets: 3, reps: "5-8", restSec: 90, rpe: 8, muscle: "quads" },
      { name: "Step Up", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5, muscle: "quads" },
    ],
  },
  hamstrings: {
    gym: [
      { name: "Romanian Deadlift", sets: 4, reps: "6-8", restSec: 150, rpe: 8, muscle: "hamstrings" },
      { name: "Lying Leg Curls", sets: 3, reps: "8-12", restSec: 90, rpe: 8, muscle: "hamstrings" },
      { name: "Seated Leg Curl", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5, muscle: "hamstrings" },
      { name: "Good Morning", sets: 3, reps: "8-10", restSec: 120, rpe: 7.5, muscle: "hamstrings" },
    ],
    db: [
      { name: "Dumbbell RDL", sets: 4, reps: "8-10", restSec: 120, rpe: 8, muscle: "hamstrings" },
      { name: "Single-Leg Dumbbell RDL", sets: 3, reps: "8-10", restSec: 90, rpe: 8, muscle: "hamstrings" },
      { name: "Floor Leg Curl", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5, muscle: "hamstrings" },
      { name: "Glute Bridge", sets: 3, reps: "10-15", restSec: 60, rpe: 7, muscle: "hamstrings" },
    ],
    body: [
      { name: "Nordic Hamstring Curl", sets: 4, reps: "5-8", restSec: 90, rpe: 8, muscle: "hamstrings" },
      { name: "Single-Leg Glute Bridge", sets: 3, reps: "8-12", restSec: 60, rpe: 8, muscle: "hamstrings" },
      { name: "Sliding Leg Curl", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5, muscle: "hamstrings" },
      { name: "Good Morning (bodyweight)", sets: 3, reps: "10-15", restSec: 60, rpe: 7, muscle: "hamstrings" },
    ],
  },
  calves: {
    gym: [
      { name: "Standing Calf Raises", sets: 4, reps: "8-12", restSec: 60, rpe: 8, muscle: "calves" },
      { name: "Seated Calf Raise", sets: 4, reps: "10-15", restSec: 45, rpe: 8, muscle: "calves" },
      { name: "Donkey Calf Raise", sets: 3, reps: "10-15", restSec: 45, rpe: 7.5, muscle: "calves" },
    ],
    db: [
      { name: "Dumbbell Calf Raise", sets: 4, reps: "10-15", restSec: 45, rpe: 8, muscle: "calves" },
      { name: "Single-Leg Calf Raise", sets: 4, reps: "8-12", restSec: 45, rpe: 8, muscle: "calves" },
      { name: "Seated Dumbbell Calf Raise", sets: 3, reps: "12-15", restSec: 45, rpe: 7.5, muscle: "calves" },
    ],
    body: [
      { name: "Calf Raise", sets: 4, reps: "12-20", restSec: 45, rpe: 8, muscle: "calves" },
      { name: "Single-Leg Calf Raise", sets: 4, reps: "10-15", restSec: 45, rpe: 8, muscle: "calves" },
      { name: "Pause Calf Raise", sets: 3, reps: "10-15", restSec: 45, rpe: 7.5, muscle: "calves" },
    ],
  },
};

const UPPER = new Set(["chest", "back", "shoulders", "arms"]);
const LOWER = new Set(["glutes", "quads", "hamstrings", "calves"]);
const ALL_MUSCLES = Object.keys(BANK);
const FOCUS_SHARE = 0.4;
const FOCUS_BAND = 0.05; // 35-45%

const SECONDARY: Record<string, string[]> = {
  chest: ["shoulders", "arms"],
  back: ["arms", "shoulders"],
  shoulders: ["arms", "chest"],
  arms: [],
  core: [],
  glutes: ["hamstrings"],
  quads: ["glutes", "hamstrings"],
  hamstrings: ["glutes"],
  calves: [],
};

function modeFromEquipment(equipment: string[]): Mode {
  const eq = new Set(equipment.map((e) => e.toLowerCase()));
  if (eq.has("barbell") || eq.has("full gym") || eq.has("machine") || eq.has("cable")) return "gym";
  if (eq.has("dumbbell") || eq.has("kettlebells")) return "db";
  return "body";
}

function clone(slot: Slot, sets = slot.sets): Slot {
  return { ...slot, sets };
}

function titleCase(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function isUnsafe(name: string, injuries: string) {
  const inj = injuries.toLowerCase();
  if (!inj) return false;
  if ((inj.includes("knee") || inj.includes("back")) && /squat|jump/i.test(name)) return true;
  if (inj.includes("back") && /deadlift/i.test(name)) return true;
  return false;
}

function sameRegion(a: string, b: string) {
  return (UPPER.has(a) && UPPER.has(b)) || (LOWER.has(a) && LOWER.has(b));
}

function applyFocusRatio(lifts: Slot[], focus: Set<string>): Slot[] {
  if (!focus.size || !lifts.length) return lifts;
  const next = lifts.map((l) => ({ ...l }));
  const isFocus = (l: Slot) => focus.has(l.muscle);
  let focusSets = next.filter(isFocus).reduce((s, l) => s + l.sets, 0);
  let otherSets = next.filter((l) => !isFocus(l)).reduce((s, l) => s + l.sets, 0);
  const total = Math.max(1, focusSets + otherSets);
  const wantFocus = Math.max(1, Math.round(total * FOCUS_SHARE));

  while (focusSets < wantFocus) {
    const lift = next.find((l) => isFocus(l) && l.sets < 5);
    if (!lift) break;
    lift.sets += 1;
    focusSets += 1;
  }
  while (otherSets > total - wantFocus) {
    const lift = [...next].reverse().find((l) => !isFocus(l) && l.sets > 2);
    if (!lift) break;
    lift.sets -= 1;
    otherSets -= 1;
  }
  return next.filter((l) => l.sets > 0);
}

function tally(lifts: Slot[], focus: Set<string>) {
  let focusSets = 0;
  let otherSets = 0;
  for (const l of lifts) {
    const primaryIsFocus = focus.has(l.muscle);
    // primary counts fully
    if (primaryIsFocus) focusSets += l.sets;
    else otherSets += l.sets;
    // secondary activation counts at 0.5 weight toward volume tally
    for (const sec of SECONDARY[l.muscle] ?? []) {
      if (focus.has(sec)) focusSets += l.sets * 0.5;
      else if (!primaryIsFocus) {
        // only count other secondary if primary already counted as other, to avoid double counting focus as other
        // keep otherSets as is, secondary variety is implicit
      }
    }
  }
  // also count secondary hits that land on non-focus muscles as other volume for ratio
  // recompute other with secondaries
  let secOther = 0;
  for (const l of lifts) {
    for (const sec of SECONDARY[l.muscle] ?? []) {
      if (!focus.has(sec) && !focus.has(l.muscle)) secOther += l.sets * 0.5;
    }
  }
  otherSets += secOther;
  return { focusSets, otherSets, total: focusSets + otherSets };
}

export function volumeBreakdown(lifts: Slot[], focus: string[]) {
  const set = new Set(focus.map((m) => m.toLowerCase()));
  return tally(lifts, set);
}

function applyWeeklyFocusRatio(days: { isRest: boolean; lifts: Slot[] }[], focus: Set<string>) {
  if (!focus.size) return;
  const listed = (pred: (s: Slot) => boolean) =>
    days.flatMap((d) => (d.isRest ? [] : d.lifts.filter(pred)));
  const bump = (list: Slot[], cap: number) => {
    const lift = list.find((l) => l.sets < cap);
    if (!lift) return false;
    lift.sets += 1;
    return true;
  };
  const trim = (list: Slot[], floor: number) => {
    const lift = [...list].reverse().find((l) => l.sets > floor);
    if (!lift) return false;
    lift.sets -= 1;
    return true;
  };

  for (let i = 0; i < 80; i++) {
    const all = days.flatMap((d) => (d.isRest ? [] : d.lifts));
    const { focusSets, total } = tally(all, focus);
    if (!total) break;
    const share = focusSets / total;
    const low = FOCUS_SHARE - FOCUS_BAND; // 0.35
    const high = FOCUS_SHARE + FOCUS_BAND; // 0.45
    if (share >= low && share <= high) break;
    if (share < low) {
      // need more focus volume: bump focus or trim other
      if (bump(listed((l) => focus.has(l.muscle)), 5)) continue;
      if (trim(listed((l) => !focus.has(l.muscle)), 1)) continue;
      break;
    }
    // share > high -> too much focus, trim focus or bump other
    if (trim(listed((l) => focus.has(l.muscle)), 1)) continue;
    if (bump(listed((l) => !focus.has(l.muscle)), 5)) continue;
    break;
  }

  for (const d of days) {
    if (!d.isRest) d.lifts = d.lifts.filter((l) => l.sets > 0);
  }
}

function maintainMuscles(focus: string[]): string[] {
  const set = new Set(focus);
  const pool = ALL_MUSCLES.filter((m) => !set.has(m));
  const prefer = focus.every((m) => UPPER.has(m))
    ? pool.filter((m) => LOWER.has(m))
    : focus.every((m) => LOWER.has(m))
      ? pool.filter((m) => UPPER.has(m))
      : pool;
  return (prefer.length ? prefer : pool).slice(0, 3);
}

function buildSession(
  theme: string[],
  focus: string[],
  mode: Mode,
  maintain: string[],
  injuries = "",
): Slot[] {
  const lifts: Slot[] = [];
  const used = new Set<string>();
  const take = (muscle: string, count: number, extraSets = 0) => {
    const order: Mode[] = ["gym", "db", "body"];
    const pools: Mode[] = [mode, ...order.filter((item) => item !== mode)];
    let added = 0;
    for (const md of pools) {
      const options = (BANK[muscle]?.[md] ?? []).filter((slot) => !isUnsafe(slot.name, injuries));
      for (const slot of options) {
        if (used.has(slot.name) || added >= count) continue;
        used.add(slot.name);
        lifts.push(clone(slot, Math.min(5, Math.max(2, slot.sets + extraSets))));
        added += 1;
      }
      if (added >= count) break;
    }
  };
  for (const muscle of theme) take(muscle, theme.length === 1 ? 3 : 2, 0);
  if (theme.length > 1) {
    for (const muscle of focus.filter((m) => !theme.includes(m))) {
      if (theme.some((t) => sameRegion(t, muscle))) take(muscle, 1);
    }
  }
  for (const muscle of maintain) {
    if (lifts.length >= 6) break;
    take(muscle, 1, -1);
  }
  return applyFocusRatio(lifts.slice(0, 6), new Set(focus));
}

function themesForSplit(split: string, focus: string[], n: number): string[][] {
  const fallbackFocus = focus.length ? focus : ["chest", "back", "quads"];
  if (split === "full-body") {
    // whole-body each session — rotate emphasis but keep all regions
    return Array.from({ length: n }, () => fallbackFocus.slice(0, 3));
  }
  if (split === "bro-split") {
    // one muscle per session, high per-session volume
    const cycle = fallbackFocus.length ? fallbackFocus : ALL_MUSCLES.slice(0, 6);
    // spread across ALL_MUSCLES for variety when focus is small, but prioritise focus first
    const order = [...cycle, ...ALL_MUSCLES.filter((m) => !cycle.includes(m))];
    return Array.from({ length: n }, (_, i) => [order[i % order.length]]);
  }
  if (split === "push-pull-legs") {
    // push = chest/shoulders/triceps(arms), pull = back/biceps(arms), legs = quads/glutes/hamstrings/calves
    const cycle: string[][] = [
      ["chest", "shoulders", "arms"],
      ["back", "arms"],
      ["quads", "glutes", "hamstrings", "calves"],
    ];
    if (n === 3) return cycle;
    if (n === 6) return [...cycle, ...cycle];
    if (n === 5) return [...cycle, cycle[0], cycle[1]]; // repeat push/pull for 5th day to keep frequency even
    // n=4 should not happen for PPL (but fallback)
    return Array.from({ length: n }, (_, i) => cycle[i % 3]);
  }
  // upper-lower: alternate upper / lower
  const upper = fallbackFocus.filter((m) => UPPER.has(m));
  const lower = fallbackFocus.filter((m) => LOWER.has(m));
  const U = upper.length ? upper : ["chest", "back", "shoulders", "arms"];
  const L = lower.length ? lower : ["quads", "glutes", "hamstrings"];
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? U : L));
}

export function determineSplit(days: number, exp: string, focus: string[] = [], goal: string | null = null) {
  const d = Math.min(6, Math.max(2, days));
  const isAdv = exp === "advanced";
  const isInterPlus = exp === "intermediate" || isAdv;
  const isHyper = goal === "hypertrophy" || goal === "recomp";

  // 1) Bro Split — narrow: 5-6 days AND explicitly advanced
  if (d >= 5 && d <= 6 && isAdv) return "bro-split";

  // 2) PPL — 3,5,6 with hypertrophy-leaning goal OR intermediate/advanced
  if ((d === 3 || d === 5 || d === 6) && (isHyper || isInterPlus)) return "push-pull-legs";

  // 3) Hard constraints by frequency
  if (d <= 3) return "full-body";
  if (d === 4) return "upper-lower";
  if (d >= 5) return "push-pull-legs";
  return "upper-lower";
}

function splitLabel(split: string, theme: string[], idx: number, n: number): string {
  const tc = (s: string) => titleCase(s);
  if (split === "full-body") return `Full Body ${String.fromCharCode(65 + idx)}`;
  if (split === "upper-lower") return idx % 2 === 0 ? `Upper ${idx < 2 ? "A" : "B"}` : `Lower ${idx < 2 ? "A" : "B"}`;
  if (split === "push-pull-legs") {
    const cycle = ["Push", "Pull", "Legs"];
    return cycle[idx % 3];
  }
  if (split === "bro-split") {
    const m = theme[0] ?? "Body";
    return `${tc(m)} Day`;
  }
  return theme.map(tc).join(" / ");
}

export type FallbackDay = {
  weekday: number;
  title: string;
  isRest: boolean;
  coachNotes: string;
  exercises: Omit<Slot, "muscle">[];
};

export function buildFallbackPlan(input: {
  daysPerWeek: number;
  equipment: string[];
  goal: string | null;
  injuries: string;
  availableDays: number[];
  focusMuscles?: string[];
  experience?: string | null;
}): { title: string; split: string; focus: string; rationale: string; days: FallbackDay[] } {
  const mode = modeFromEquipment(input.equipment);
  const daysWanted = Math.min(6, Math.max(2, input.availableDays.length || input.daysPerWeek || 4));
  const available = (input.availableDays.length ? input.availableDays : [1, 2, 3, 4, 5]).slice(0, daysWanted);
  const focus = (input.focusMuscles ?? []).map((m) => m.toLowerCase()).filter((m) => BANK[m]);
  const maintain = maintainMuscles(focus.length ? focus : ["chest", "back", "quads"]);
  const split = determineSplit(available.length, input.experience ?? "", focus, input.goal ?? null);
  const themes = themesForSplit(split, focus, available.length);

  type Built = { weekday: number; title: string; isRest: boolean; coachNotes: string; lifts: Slot[] };
  const built: Built[] = [];

  for (let wd = 0; wd < 7; wd++) {
    const idx = available.indexOf(wd);
    if (idx < 0) {
      built.push({
        weekday: wd,
        title: "Rest / walk",
        isRest: true,
        coachNotes: "Easy movement only. Sleep and protein do the work.",
        lifts: [],
      });
      continue;
    }
    const theme = themes[idx] ?? focus.slice(0, 2);
    const isMaintainDay = theme.every((m) => !focus.includes(m)) && focus.length > 0;
    const lifts = buildSession(
      theme,
      isMaintainDay ? [] : focus,
      mode,
      isMaintainDay ? [] : maintain,
      input.injuries,
    );
    const label = splitLabel(split, theme, idx, available.length);
    built.push({
      weekday: wd,
      title: label,
      isRest: false,
      coachNotes: isMaintainDay
        ? "Light maintenance so the rest of you keeps moving. Focus volume lives on the named days."
        : `Most of today's sets hit ${focus.map(titleCase).join(" + ") || label}. Other work is maintenance.`,
      lifts,
    });
  }

  applyWeeklyFocusRatio(built, new Set(focus));

  const days: FallbackDay[] = built.map((d) => ({
    weekday: d.weekday,
    title: d.title,
    isRest: d.isRest,
    coachNotes: d.coachNotes,
    exercises: d.lifts.map(({ muscle: _m, ...rest }) => rest),
  }));

  const allLifts = built.flatMap((d) => (d.isRest ? [] : d.lifts));
  const { focusSets, total } = tally(allLifts, new Set(focus));
  const sharePct = total && focus.length ? Math.round((100 * focusSets) / total) : 0;
  const focusLabel = focus.length ? focus.map(titleCase).join(" + ") : (input.goal ?? "general");

  return {
    title: `${available.length}-day ${focusLabel}`,
    split,
    focus: focusLabel,
    rationale: focus.length
      ? `${split} week built around ${focusLabel}. ${sharePct}% of working sets hit those muscles; the other ${Math.max(0, 100 - sharePct)}% is maintenance.`
      : "Starter week from your equipment and schedule. Rebuild after you pick target muscles.",
    days,
  };
}
