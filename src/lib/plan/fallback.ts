import type { Profile } from "../api/types.ts";
import { FOCUS_MUSCLES } from "../muscles.ts";
import {
  EXERCISE_CATALOG,
  equipmentGroup,
  getExercise,
  matchExercise,
  type Exercise,
} from "../exercises/catalog.ts";

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

export type FallbackProfile = Pick<
  Profile,
  | "daysPerWeek"
  | "availableDays"
  | "equipment"
  | "experience"
  | "goal"
  | "focusMuscles"
  | "sessionMinutes"
  | "injuries"
>;

export function determineSplit(
  daysPerWeek: number,
  experience: string | null = null,
  _focusMuscles: readonly string[] = [],
  _goal: string | null = null,
): string {
  if (daysPerWeek <= 3 || experience === "beginner") return "Full Body";
  if (daysPerWeek === 4) return "Upper / Lower";
  return "Push / Pull / Legs";
}

const preferred = [
  "Barbell_Squat",
  "Barbell_Bench_Press_-_Medium_Grip",
  "Bent_Over_Barbell_Row",
  "Romanian_Deadlift",
  "Barbell_Hip_Thrust",
  "Standing_Military_Press",
  "Dumbbell_Squat",
  "Dumbbell_Bench_Press",
  "One-Arm_Dumbbell_Row",
  "Stiff-Legged_Dumbbell_Deadlift",
  "Dumbbell_Shoulder_Press",
  "Dumbbell_Bicep_Curl",
  "Side_Lateral_Raise",
  "Leg_Press",
  "Lying_Leg_Curls",
  "Triceps_Pushdown",
  "Standing_Calf_Raises",
  "Bodyweight_Squat",
  "Pushups",
  "Superman",
  "Butt_Lift_Bridge",
  "Pike_Push_Up",
  "Plank",
  "Dead_Bug",
  "Single_Leg_Glute_Bridge",
];

export function buildFallbackPlanExercise(ex: Exercise, mode: Slot["mode"]): Slot {
  return {
    exerciseId: ex.id,
    name: ex.name,
    sets: 3,
    reps: ex.force === "static" ? "20-30 sec" : ex.mechanic === "compound" ? "8-10" : "10-15",
    restSec: ex.mechanic === "compound" ? 120 : 60,
    rpe: 7,
    muscle: ex.focusPrimary[0] ?? "core",
    mode,
  };
}

export function buildFallbackBank(catalog: ReadonlyMap<string, Exercise>) {
  const bank: Record<string, Record<Slot["mode"], Slot[]>> = {};
  for (const muscle of FOCUS_MUSCLES) {
    bank[muscle.id] = { gym: [], db: [], body: [] };
  }
  for (const ex of catalog.values()) {
    if (ex.kind !== "strength" || ex.advanced || ex.canonicalId !== ex.id) continue;
    const mode: Slot["mode"] = ex.equipmentGroup.some((g) =>
      ["barbell", "machine", "cable"].includes(g),
    )
      ? "gym"
      : ex.equipmentGroup.some((g) => ["dumbbell", "kettlebell"].includes(g))
        ? "db"
        : "body";
    if (mode === "body" && !ex.equipmentGroup.includes("body only")) continue;
    for (const muscle of ex.focusPrimary)
      bank[muscle]?.[mode].push(buildFallbackPlanExercise(ex, mode));
  }
  return bank;
}

export const FALLBACK_BANK = buildFallbackBank(EXERCISE_CATALOG);
export const BANK = FALLBACK_BANK;

/** Conservative pattern exclusions, not a diagnosis or a rehab prescription. */
export function isUnsafe(name: string, injuries: string): boolean {
  if (!injuries || /^(none|no injuries|n\/a)$/i.test(injuries.trim())) return false;
  if (/knee/i.test(injuries) && /squat|lunge|jump|leg press|step.?up|pistol/i.test(name))
    return true;
  if (
    /back|spine/i.test(injuries) &&
    /deadlift|squat|good morning|bent.over|sit.?up|hyperextension/i.test(name)
  )
    return true;
  if (
    /shoulder/i.test(injuries) &&
    /press|push.?up|pushups|dip|fly|raise|pull.?up|pullups|chin/i.test(name)
  )
    return true;
  if (/wrist|elbow/i.test(injuries) && /press|push.?up|pushups|dip|curl|plank/i.test(name))
    return true;
  if (/hip/i.test(injuries) && /squat|lunge|deadlift|hip thrust|jump/i.test(name)) return true;
  return false;
}

export function volumeBreakdown(
  exercises: readonly {
    exerciseId?: string | null;
    name?: string;
    exerciseName?: string;
    sets: number;
  }[],
  focusMuscles: readonly string[],
) {
  let totalSets = 0;
  let focusSets = 0;
  const focus = new Set(focusMuscles.map((m) => m.toLowerCase()));
  for (const slot of exercises) {
    const sets = Math.max(0, slot.sets);
    totalSets += sets;
    const resolved = slot.exerciseId ? getExercise(slot.exerciseId) : null;
    const match = resolved ? null : matchExercise(slot.name ?? slot.exerciseName ?? "");
    const ex = resolved ?? (match ? getExercise(match.id) : null);
    if (ex && [...ex.focusPrimary, ...ex.focusSecondary].some((m) => focus.has(m)))
      focusSets += sets;
  }
  return {
    totalSets,
    focusSets,
    otherSets: totalSets - focusSets,
    ratio: totalSets ? focusSets / totalSets : 0,
  };
}

export function buildFallbackPlan(profile: FallbackProfile) {
  const available = [...new Set(profile.availableDays)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort();
  const count = Math.min(Math.max(1, Math.trunc(profile.daysPerWeek)), available.length);
  const trainingDays = available.slice(0, count);
  const split = determineSplit(count, profile.experience, profile.focusMuscles, profile.goal);
  const focus = new Set(profile.focusMuscles.filter((m) => FOCUS_MUSCLES.some((f) => f.id === m)));
  const equipment = new Set(profile.equipment.map(equipmentGroup));
  equipment.add("body only");
  const fullGym = equipment.has("full gym");
  const mode: Slot["mode"] =
    fullGym || [...equipment].some((g) => ["barbell", "machine", "cable"].includes(g))
      ? "gym"
      : equipment.has("dumbbell") || equipment.has("kettlebell")
        ? "db"
        : "body";
  const candidates = [...EXERCISE_CATALOG.values()]
    .filter((ex) => {
      if (ex.kind !== "strength" || ex.canonicalId !== ex.id) return false;
      if (ex.advanced && profile.experience !== "advanced") return false;
      if (!(fullGym || ex.equipmentGroup.every((g) => equipment.has(g)))) return false;
      // Some dataset body-only labels still need a bar, rings, bench, or other prop.
      if (
        !fullGym &&
        ex.equipmentGroup.includes("body only") &&
        /ring|pull.?up|pullups|chin.?up|bench|ball|towel|ab wheel|step.?up|hang|dip/i.test(ex.name)
      )
        return false;
      if (ex.primaryMuscles.includes("neck")) return false;
      return !isUnsafe(ex.name, profile.injuries);
    })
    .sort((a, b) => {
      const rank = (ex: Exercise) => {
        const index = preferred.indexOf(ex.id);
        return index >= 0
          ? index
          : 100 +
              (ex.source === "free-exercise-db" ? 0 : 100) +
              (ex.mechanic === "compound" ? 0 : 30) +
              (ex.level === "beginner" ? 0 : 10);
      };
      return rank(a) - rank(b) || a.id.localeCompare(b.id);
    });
  const hasFocus = (ex: Exercise) =>
    [...ex.focusPrimary, ...ex.focusSecondary].some((m) => focus.has(m));
  const upper = ["chest", "back", "shoulders", "arms", "core"];
  const lower = ["quads", "hamstrings", "glutes", "calves", "core"];
  const used = new Map<string, number>();
  const liftCount = profile.sessionMinutes <= 30 ? 4 : profile.sessionMinutes >= 75 ? 6 : 5;
  const sessions = trainingDays.map((_, index) => {
    const title =
      split === "Full Body"
        ? `Full Body ${String.fromCharCode(65 + index)}`
        : split === "Upper / Lower"
          ? `${index % 2 ? "Lower" : "Upper"} ${index < 2 ? "A" : "B"}`
          : ["Push", "Pull", "Legs"][index % 3];
    const allowed: readonly string[] =
      split === "Full Body"
        ? FOCUS_MUSCLES.map((m) => m.id)
        : title.startsWith("Upper")
          ? upper
          : title.startsWith("Lower") || title === "Legs"
            ? lower
            : title === "Push"
              ? ["chest", "shoulders", "arms", "core"]
              : ["back", "arms", "core"];
    const pool = candidates.filter(
      (ex) =>
        ex.focusPrimary.every((m) => allowed.includes(m)) &&
        (title !== "Push" || ex.force !== "pull") &&
        (title !== "Pull" || ex.force !== "push"),
    );
    const focusCapacity = Math.min(
      liftCount,
      pool.filter((ex) => ex.focusPrimary.some((m) => focus.has(m))).length,
    );
    return { title, pool, focusCapacity };
  });
  const capacity = sessions.reduce((n, s) => n + s.focusCapacity, 0);
  const focusTarget = Math.min(Math.round(trainingDays.length * liftCount * 0.4), capacity);
  let remainingFocus = focusTarget;
  let remainingCapacity = capacity;
  const days = Array.from({ length: 7 }, (_, weekday) => {
    const index = trainingDays.indexOf(weekday);
    if (index < 0)
      return {
        weekday,
        title: "Rest",
        isRest: true,
        coachNotes: "Recover and move gently.",
        exercises: [] as Slot[],
      };
    const { title: session, pool, focusCapacity } = sessions[index];
    const picked: Exercise[] = [];
    const focusCount = remainingCapacity
      ? Math.min(focusCapacity, Math.round((remainingFocus * focusCapacity) / remainingCapacity))
      : 0;
    remainingFocus -= focusCount;
    remainingCapacity -= focusCapacity;
    const muscles = new Map<string, number>();
    for (let slot = 0; slot < liftCount; slot++) {
      const remaining = pool.filter((e) => !picked.some((p) => p.id === e.id));
      const wantFocus = slot < focusCount;
      const matching = remaining.filter((e) =>
        wantFocus ? e.focusPrimary.some((m) => focus.has(m)) : !hasFocus(e),
      );
      const options = matching.length ? matching : remaining;
      options.sort((a, b) => {
        const penalty = (ex: Exercise) =>
          (used.get(ex.id) ?? 0) * 2 +
          ex.focusPrimary.reduce((sum, m) => sum + (muscles.get(m) ?? 0), 0) * 4;
        return penalty(a) - penalty(b);
      });
      const ex = options[0];
      if (!ex) break;
      picked.push(ex);
      used.set(ex.id, (used.get(ex.id) ?? 0) + 1);
      for (const muscle of ex.focusPrimary) muscles.set(muscle, (muscles.get(muscle) ?? 0) + 1);
    }
    picked.sort((a, b) => Number(b.mechanic === "compound") - Number(a.mechanic === "compound"));
    const exercises = picked.map((ex) => {
      const slot = buildFallbackPlanExercise(ex, mode);
      if (profile.experience === "beginner") {
        slot.sets = 2;
        slot.rpe = 6;
      }
      if (profile.goal === "strength" && ex.mechanic === "compound" && ex.force !== "static") {
        slot.reps = "5-8";
        slot.restSec = 180;
      }
      return slot;
    });
    return {
      weekday,
      title: exercises.length ? session : "Rest",
      isRest: exercises.length === 0,
      coachNotes: profile.injuries
        ? "Use a pain-free range. Stop if symptoms worsen; seek qualified guidance."
        : "Warm up first. Leave 2-3 reps in reserve and progress gradually.",
      exercises,
    };
  });
  const volume = volumeBreakdown(
    days.flatMap((d) => d.exercises),
    [...focus],
  );
  return {
    title: `${split} Starter`,
    split,
    focus: [...focus].join(", "),
    rationale: focus.size
      ? `Targets roughly 40% focus / 60% variety work within the split. This starter has ${Math.round(volume.ratio * 100)}% focus sets; equipment and injury restrictions take priority.`
      : "A balanced starter using your available equipment and training days. Keep effort conservative while building consistency.",
    days,
  };
}
