type Slot = { name: string; sets: number; reps: string; restSec: number; rpe: number; notes?: string };

const BARBELL_UL: Record<string, Slot[]> = {
  upper: [
    { name: "Barbell Bench Press - Medium Grip", sets: 4, reps: "6-8", restSec: 180, rpe: 8 },
    { name: "Bent Over Barbell Row", sets: 4, reps: "6-8", restSec: 150, rpe: 8 },
    { name: "Seated Barbell Military Press", sets: 3, reps: "8-10", restSec: 120, rpe: 7.5 },
    { name: "Wide-Grip Lat Pulldown", sets: 3, reps: "8-12", restSec: 90, rpe: 7 },
    { name: "Close-Grip Barbell Bench Press", sets: 3, reps: "8-10", restSec: 90, rpe: 7.5 },
    { name: "Barbell Curl", sets: 2, reps: "10-12", restSec: 75, rpe: 7 },
  ],
  lower: [
    { name: "Barbell Squat", sets: 4, reps: "5-8", restSec: 180, rpe: 8 },
    { name: "Romanian Deadlift", sets: 3, reps: "6-8", restSec: 150, rpe: 7.5 },
    { name: "Front Barbell Squat", sets: 3, reps: "8-10", restSec: 150, rpe: 7 },
    { name: "Lying Leg Curls", sets: 3, reps: "10-12", restSec: 90, rpe: 7 },
    { name: "Standing Calf Raises", sets: 4, reps: "8-12", restSec: 75, rpe: 8 },
  ],
};

const DB_UL: Record<string, Slot[]> = {
  upper: [
    { name: "Dumbbell Bench Press", sets: 4, reps: "8-10", restSec: 120, rpe: 8 },
    { name: "Dumbbell One-Arm Row", sets: 4, reps: "8-10", restSec: 90, rpe: 8 },
    { name: "Dumbbell Shoulder Press", sets: 3, reps: "8-12", restSec: 90, rpe: 7.5 },
    { name: "Incline Dumbbell Flyes", sets: 3, reps: "10-12", restSec: 75, rpe: 7 },
    { name: "Dumbbell Bicep Curl", sets: 2, reps: "10-12", restSec: 60, rpe: 7 },
    { name: "Dumbbell Kickback", sets: 2, reps: "12-15", restSec: 60, rpe: 7 },
  ],
  lower: [
    { name: "Dumbbell Goblet Squat", sets: 4, reps: "8-12", restSec: 120, rpe: 8 },
    { name: "Dumbbell RDL", sets: 3, reps: "8-10", restSec: 120, rpe: 7.5 },
    { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "8-10", restSec: 90, rpe: 7.5 },
    { name: "Dumbbell Walking Lunge", sets: 3, reps: "10-12", restSec: 90, rpe: 7 },
    { name: "Dumbbell Calf Raise", sets: 4, reps: "10-15", restSec: 60, rpe: 8 },
  ],
};

const BODY: Record<string, Slot[]> = {
  push: [
    { name: "Pushups", sets: 4, reps: "8-15", restSec: 90, rpe: 8 },
    { name: "Pike Push-Up", sets: 3, reps: "6-10", restSec: 90, rpe: 7.5 },
    { name: "Diamond Push-Up", sets: 3, reps: "8-12", restSec: 75, rpe: 7.5 },
    { name: "Plank", sets: 3, reps: "30-45s", restSec: 60, rpe: 7 },
  ],
  pull: [
    { name: "Pullups", sets: 4, reps: "5-10", restSec: 120, rpe: 8 },
    { name: "Inverted Row", sets: 4, reps: "8-12", restSec: 90, rpe: 7.5 },
    { name: "Superman", sets: 3, reps: "10-15", restSec: 60, rpe: 7 },
    { name: "Hanging Leg Raise", sets: 3, reps: "8-12", restSec: 60, rpe: 7 },
  ],
  legs: [
    { name: "Bodyweight Squat", sets: 4, reps: "12-20", restSec: 90, rpe: 8 },
    { name: "Walking Lunge", sets: 3, reps: "10-14", restSec: 75, rpe: 7.5 },
    { name: "Pistol Squat", sets: 3, reps: "5-8", restSec: 90, rpe: 8 },
    { name: "Nordic Hamstring Curl", sets: 3, reps: "5-8", restSec: 90, rpe: 8 },
    { name: "Calf Raise", sets: 4, reps: "12-20", restSec: 45, rpe: 8 },
  ],
};

const FOCUS_EXTRA: Record<string, Slot> = {
  chest: { name: "Incline Dumbbell Flyes", sets: 3, reps: "10-12", restSec: 75, rpe: 8 },
  back: { name: "Wide-Grip Lat Pulldown", sets: 3, reps: "8-12", restSec: 90, rpe: 8 },
  shoulders: { name: "Dumbbell Shoulder Press", sets: 3, reps: "8-12", restSec: 90, rpe: 8 },
  arms: { name: "Barbell Curl", sets: 3, reps: "8-12", restSec: 75, rpe: 8 },
  core: { name: "Hanging Leg Raise", sets: 3, reps: "8-12", restSec: 60, rpe: 8 },
  glutes: { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "8-10", restSec: 90, rpe: 8 },
  quads: { name: "Front Barbell Squat", sets: 3, reps: "6-10", restSec: 150, rpe: 8 },
  hamstrings: { name: "Romanian Deadlift", sets: 3, reps: "6-8", restSec: 150, rpe: 8 },
  calves: { name: "Standing Calf Raises", sets: 4, reps: "10-15", restSec: 60, rpe: 8 },
};

const UPPER_FOCUS = new Set(["chest", "back", "shoulders", "arms"]);
const LOWER_FOCUS = new Set(["glutes", "quads", "hamstrings", "calves"]);

export type FallbackDay = {
  weekday: number;
  title: string;
  isRest: boolean;
  coachNotes: string;
  exercises: Slot[];
};

export function buildFallbackPlan(input: {
  daysPerWeek: number;
  equipment: string[];
  goal: string | null;
  injuries: string;
  availableDays: number[];
  focusMuscles?: string[];
}): { title: string; split: string; focus: string; rationale: string; days: FallbackDay[] } {
  const eq = new Set(input.equipment.map((e) => e.toLowerCase()));
  const hasBarbell = eq.has("barbell") || eq.has("full gym");
  const hasDb = eq.has("dumbbell") || eq.has("full gym");
  const pool = hasBarbell ? BARBELL_UL : hasDb ? DB_UL : BODY;
  const daysWanted = Math.min(6, Math.max(2, input.daysPerWeek));
  const available = input.availableDays.length ? input.availableDays : [1, 2, 3, 4, 5];
  const trainingDays = available.slice(0, daysWanted);
  const focus = (input.focusMuscles ?? []).map((m) => m.toLowerCase());
  const wantsUpper = focus.some((m) => UPPER_FOCUS.has(m));
  const wantsLower = focus.some((m) => LOWER_FOCUS.has(m));

  const days: FallbackDay[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (!trainingDays.includes(wd)) {
      days.push({
        weekday: wd,
        title: "Rest / walk",
        isRest: true,
        coachNotes: "Easy movement only. Sleep and protein do the work.",
        exercises: [],
      });
      continue;
    }
    const i = trainingDays.indexOf(wd);
    if (pool === BODY) {
      const keys = ["push", "pull", "legs"] as const;
      const key = keys[i % 3];
      days.push({
        weekday: wd,
        title: key[0].toUpperCase() + key.slice(1),
        isRest: false,
        coachNotes: "Leave 1–2 reps in the tank. Quality over volume.",
        exercises: [...BODY[key]],
      });
    } else {
      let key: "upper" | "lower" = i % 2 === 0 ? "upper" : "lower";
      if (wantsUpper && !wantsLower) key = "upper";
      if (wantsLower && !wantsUpper) key = i % 3 === 2 ? "lower" : "upper";
      if (wantsLower && !wantsUpper && i % 2 === 1) key = "lower";
      days.push({
        weekday: wd,
        title: key === "upper" ? "Upper" : "Lower",
        isRest: false,
        coachNotes: focus.length
          ? `Extra volume for ${focus.join(", ")}. First two lifts are the mission.`
          : "First two lifts are the mission. Accessories are optional if time is short.",
        exercises: [...(pool as Record<string, Slot[]>)[key]],
      });
    }
  }

  for (const muscle of focus) {
    const extra = FOCUS_EXTRA[muscle];
    if (!extra) continue;
    const target =
      days.find((d) => !d.isRest && (UPPER_FOCUS.has(muscle) ? /upper|push|pull/i.test(d.title) : /lower|legs/i.test(d.title))) ??
      days.find((d) => !d.isRest);
    if (!target) continue;
    if (!target.exercises.some((e) => e.name === extra.name)) {
      target.exercises = [...target.exercises.slice(0, 5), extra];
    } else {
      target.exercises = target.exercises.map((e) =>
        e.name === extra.name ? { ...e, sets: Math.min(5, e.sets + 1) } : e,
      );
    }
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
  const ratio = totalSets > 0 ? targetedSets / totalSets : 0;
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

  const split = pool === BODY ? "push-pull-legs" : "upper-lower";
  const focusLabel = focus.length ? focus.join(" + ") : (input.goal ?? "strength");
  return {
    title: focus.length ? `${daysWanted}-day ${focusLabel}` : `${daysWanted}-day ${split.replace("-", " / ")}`,
    split,
    focus: focusLabel,
    rationale: focus.length
      ? `Starter block biased toward ${focusLabel}. Other muscle groups stay in as maintenance until the coach retunes from your logs.`
      : "Starter block built from your equipment, schedule, and stated limitations. The coach will retune it after your first logged sessions.",
    days,
  };
}
