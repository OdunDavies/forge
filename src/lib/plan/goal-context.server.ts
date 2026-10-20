import type { Sql } from "../db.server.ts";
import { asStringArray } from "../db-map.ts";
import { goalAnalysisSchema, trainingGoals } from "../body-goal.ts";

/** A scan must belong to the authenticated athlete before it can shape their plan. */
export async function loadPlanGoalContext(sql: Sql, userId: string, scanId?: number) {
  if (scanId === undefined) return null;
  const rows = await sql<{
    summary: string;
    focus_muscles: unknown;
    training_notes: unknown;
    limitations: string;
    training_goal: string | null;
  }>`
    select summary, focus_muscles, training_notes, limitations, training_goal
    from goal_scans where id = ${scanId} and user_id = ${userId}`;
  const row = rows[0];
  if (!row)
    throw new Error(
      "This photo analysis is no longer available. Analyze your photos again or choose a goal.",
    );
  const analysis = goalAnalysisSchema.parse({
    summary: row.summary,
    focusMuscles: asStringArray(row.focus_muscles),
    trainingNotes: asStringArray(row.training_notes),
    limitations: row.limitations,
  });
  const trainingGoal = trainingGoals.find((goal) => goal === row.training_goal);
  return { ...analysis, trainingGoal };
}
