import type { GeneratedPlan } from "./schema.ts";

/** Language generation can explain a plan, but cannot undo validated programming or restrictions. */
export function assertPlanStructure(candidate: GeneratedPlan, base: GeneratedPlan): void {
  if (candidate.split !== base.split || candidate.days.length !== base.days.length) {
    throw new Error("Plan changed the chosen split or schedule");
  }
  for (const expected of base.days) {
    const day = candidate.days.find((d) => d.weekday === expected.weekday);
    if (
      !day ||
      day.title !== expected.title ||
      day.isRest !== expected.isRest ||
      (day.exercises?.length ?? 0) !== (expected.exercises?.length ?? 0)
    ) {
      throw new Error("Plan changed a session");
    }
    for (const [index, exercise] of (expected.exercises ?? []).entries()) {
      const actual = day.exercises![index];
      for (const key of ["exerciseId", "name", "sets", "reps", "restSec", "rpe"] as const) {
        if (actual[key] !== exercise[key]) throw new Error("Plan changed a prescribed exercise");
      }
    }
  }
}
