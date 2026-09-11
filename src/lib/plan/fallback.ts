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
const FOCUS_SHARE = 0.7;

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

function applyFocusRatio(lifts: Slot[], focus: Set<string>): Slot[] {
  if (!focus.size || !lifts.length) return lifts;
  const next = lifts.map((l) => ({ ...l }));
  const isFocus = (l: Slot) => focus.has(l.muscle);
  let focusSets = next.filter(isFocus).reduce((s, l) => s + l.sets, 0);
  let otherSets = next.filter((l) => !isFocus(l)).reduce((s, l) => s + l.sets, 0);
  const total = Math.max(1, focusSets + otherSets);
  const wantFocus = Math.max(1, Math.round(total * FOCUS_SHARE));

  while (focusSets < wantFocus) {
    const lift = next.find(isFocus);
    if (!lift || lift.sets >= 6) break;
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

function buildSession(theme: string[], focus: string[], mode: Mode, maintain: string[]): Slot[] {
  const lifts: Slot[] = [];
  const used = new Set<string>();
  const take = (muscle: string, count: number, extraSets = 0) => {
    const options = BANK[muscle]?.[mode] ?? [];
    let added = 0;
    for (const slot of options) {
      if (used.has(slot.name) || added >= count) continue;
      used.add(slot.name);
      lifts.push(clone(slot, Math.min(5, slot.sets + extraSets)));
      added += 1;
    }
  };
  for (const muscle of theme) take(muscle, theme.length === 1 ? 4 : 2, 1);
  for (const muscle of focus.filter((m) => !theme.includes(m))) take(muscle, 1);
  for (const muscle of maintain) {
    if (lifts.length >= 6) break;
    take(muscle, 1, -1);
  }
  return applyFocusRatio(lifts.slice(0, 6), new Set(focus));
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
}): { title: string; split: string; focus: string; rationale: string; days: FallbackDay[] } {
  const mode = modeFromEquipment(input.equipment);
  const daysWanted = Math.min(6, Math.max(2, input.availableDays.length || input.daysPerWeek || 4));
  const available = (input.availableDays.length ? input.availableDays : [1, 2, 3, 4, 5]).slice(0, daysWanted);
  const focus = (input.focusMuscles ?? []).map((m) => m.toLowerCase()).filter((m) => BANK[m]);
  const maintain = maintainMuscles(focus.length ? focus : ["chest", "back", "quads"]);
  const themeMuscles = focus.length ? focus : ["chest", "back", "quads", "hamstrings"];

  const themes: string[][] = [];
  if (focus.length === 0) {
    const cycle = [["chest", "shoulders"], ["back", "arms"], ["quads", "glutes"]];
    for (let i = 0; i < available.length; i++) themes.push(cycle[i % cycle.length]);
  } else if (focus.length === 1) {
    for (let i = 0; i < available.length; i++) {
      themes.push(i === available.length - 1 && available.length >= 3 ? maintain.slice(0, 2) : [focus[0]]);
    }
  } else {
    for (let i = 0; i < available.length; i++) {
      const a = focus[i % focus.length];
      const b = focus[(i + 1) % focus.length];
      themes.push(a === b ? [a] : [a, b]);
    }
    if (available.length >= 4) themes[themes.length - 1] = maintain.slice(0, 2);
  }

  const days: FallbackDay[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const idx = available.indexOf(wd);
    if (idx < 0) {
      days.push({
        weekday: wd,
        title: "Rest / walk",
        isRest: true,
        coachNotes: "Easy movement only. Sleep and protein do the work.",
        exercises: [],
      });
      continue;
    }
    const theme = themes[idx] ?? themeMuscles.slice(0, 2);
    const isMaintainDay = theme.every((m) => !focus.includes(m)) && focus.length > 0;
    const lifts = buildSession(theme, isMaintainDay ? theme : focus, mode, isMaintainDay ? [] : maintain);
    const label = theme.map(titleCase).join(" / ");
    days.push({
      weekday: wd,
      title: isMaintainDay ? `Maintenance · ${label}` : label,
      isRest: false,
      coachNotes: isMaintainDay
        ? "Maintenance only — keep the focus muscles fresh."
        : `About 70% of today's sets hit ${focus.map(titleCase).join(" + ") || label}. Other work is maintenance.`,
      exercises: lifts.map(({ muscle: _m, ...rest }) => rest),
    });
  }

  // 40/60 volume‑bias: keep targeted muscle volume in the 35‑45 % band
  let totalSets = 0;
  let targetedSets = 0;
  for (const d of days) {
    if (d.isRest) continue;
    for (const ex of d.exercises) {
      totalSets += ex.sets;
      if (focus.includes(ex.name.toLowerCase())) {
        targetedSets += ex.sets;
      }
    }
  }
  let ratio = totalSets > 0 ? targetedSets / totalSets : 0;
  const targetLow = 0.35;
  const targetHigh = 0.45;

  if (ratio > targetHigh) {
    // trim focus extras starting from the last muscle added until we are in range
    for (const muscle of focus) {
      const extra = FOCUS_EXTRA[muscle];
      if (!extra) continue;
      const dayIdx = days.findIndex((d) => !d.isRest && d.exercises.some((e) => e.name === extra.name));
      if (dayIdx >= 0) {
        const ex = days[dayIdx].exercises.find((e) => e.name === extra.name);
        if (ex) {
          if (ex.sets > 1) {
            days[dayIdx].exercises = days[dayIdx].exercises.map((e) =>
              e.name === extra.name ? { ...e, sets: ex.sets - 1 } : e,
            );
          } else {
            days[dayIdx].exercises = days[dayIdx].exercises.filter((e) => e.name !== extra.name);
          }
        }
      }
      // recompute ratio after each trim
      let rTotal = 0,
        rTarget = 0;
      for (const d of days) {
        if (d.isRest) continue;
        for (const e of d.exercises) {
          rTotal += e.sets;
          if (focus.includes(e.name.toLowerCase())) rTarget += e.sets;
        }
      }
      ratio = rTotal > 0 ? rTarget / rTotal : 0;
      if (ratio <= targetHigh) break;
    }
  }

  const injured = input.injuries.toLowerCase();
  if (injured.includes("knee") || injured.includes("back")) {
    for (const d of days) {
      d.exercises = d.exercises.filter((e) => !/squat|jump/i.test(e.name));
      if (injured.includes("back")) d.exercises = d.exercises.filter((e) => !/deadlift/i.test(e.name));
    }
  }

  const focusLabel = focus.length ? focus.map(titleCase).join(" + ") : (input.goal ?? "general");
  return {
    title: `${available.length}-day ${focusLabel}`,
    split: focus.length ? `${focus.join("-")} bias` : mode === "body" ? "push-pull-legs" : "upper-lower",
    focus: focusLabel,
    rationale: focus.length
      ? `Built around ${focusLabel}. Roughly 70% of weekly sets go there; the rest is maintenance so you still move well.`
      : "Starter week from your equipment and schedule. Rebuild after you pick target muscles.",
    days,
  };
}
