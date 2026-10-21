import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db.server";
import { asStringArray } from "@/lib/db-map";
import { getAiConfig } from "@/lib/ai/config";
import { consumeAiBudget } from "@/lib/ai/rate-limit.server";
import { analyzeGoalImage, comparePhysiquePhotos, extractJson } from "@/lib/ai/grok";
import { loadProfileByUserId } from "./profile";
import {
  bodyComparisonSchema,
  comparePhotosSchema,
  goalAnalysisSchema,
  parseGoalPhoto,
  type BodyGoalScan,
} from "../body-goal";

const resultSchema = goalAnalysisSchema;
const imageSchema = z.object({ image: z.string().max(1_500_000) });
const imagePattern = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/;

type ScanRow = {
  id: number;
  summary: string;
  focus_muscles: unknown;
  training_notes: unknown;
  limitations: string;
  created_at: string;
};
function mapScan(row: ScanRow) {
  return {
    id: row.id,
    summary: row.summary,
    focusMuscles: asStringArray(row.focus_muscles),
    trainingNotes: asStringArray(row.training_notes),
    limitations: row.limitations,
    createdAt: row.created_at,
  };
}

export const listGoalScans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows =
      await sql<ScanRow>`select id, summary, focus_muscles, training_notes, limitations, created_at from goal_scans where user_id = ${context.userId} order by created_at desc, id desc limit 10`;
    return rows.map(mapScan);
  });

export const scanGoalBody = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => imageSchema.parse(input))
  .handler(async ({ context, data }) => {
    const match = imagePattern.exec(data.image);
    if (!match || Buffer.from(match[2], "base64").length > 1_000_000)
      throw new Error("Choose a JPEG, PNG, or WebP photo under 1 MB.");
    if (!getAiConfig()) throw new Error("Photo analysis is unavailable right now.");
    await consumeAiBudget(context.userId);
    const profile = await loadProfileByUserId(context.userId);
    const contextText = JSON.stringify({
      goal: profile?.goal,
      experience: profile?.experience,
      equipment: profile?.equipment,
      focusMuscles: profile?.focusMuscles,
    });
    const answer = await analyzeGoalImage(
      match[2],
      match[1] as "image/jpeg" | "image/png" | "image/webp",
      contextText,
    );
    if (!answer.ok) throw new Error(answer.error);
    const parsed = resultSchema.safeParse(extractJson(answer.text));
    if (!parsed.success) throw new Error("The scan was unclear. Try another photo.");
    const result = parsed.data;
    const sql = await getSql();
    const rows = await sql.query<ScanRow>(
      `insert into goal_scans (user_id, summary, focus_muscles, training_notes, limitations) values ($1,$2,$3::text[],$4::text[],$5) returning id, summary, focus_muscles, training_notes, limitations, created_at`,
      [
        context.userId,
        result.summary,
        result.focusMuscles,
        result.trainingNotes,
        result.limitations,
      ],
    );
    return mapScan(rows[0]);
  });

/** Photos are forwarded for this analysis only; persist the derived training direction. */
export const compareBodyPhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => comparePhotosSchema.parse(input))
  .handler(async ({ context, data }): Promise<BodyGoalScan> => {
    const current = parseGoalPhoto(data.currentImage);
    const goal = parseGoalPhoto(data.goalImage);
    if (!getAiConfig())
      throw new Error("Photo analysis is unavailable right now. You can choose a goal instead.");
    await consumeAiBudget(context.userId);
    const profile = await loadProfileByUserId(context.userId);
    const answer = await comparePhysiquePhotos(
      current,
      goal,
      JSON.stringify({
        experience: profile?.experience,
        equipment: profile?.equipment,
        injuries: profile?.injuries,
      }),
    );
    if (!answer.ok) throw new Error(answer.error);
    const parsed = bodyComparisonSchema.safeParse(extractJson(answer.text));
    if (!parsed.success)
      throw new Error(
        "We couldn't find clear training priorities in these photos. Try clearer photos or choose a goal instead.",
      );
    const result = parsed.data;
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `insert into goal_scans (user_id, summary, focus_muscles, training_notes, limitations, scan_kind, training_goal)
       values ($1,$2,$3::text[],$4::text[],$5,'comparison',$6) returning id`,
      [
        context.userId,
        result.summary,
        result.focusMuscles,
        result.trainingNotes,
        result.limitations,
        result.trainingGoal,
      ],
    );
    return { ...result, id: rows[0].id };
  });
