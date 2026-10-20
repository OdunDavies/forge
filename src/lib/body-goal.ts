import { z } from "zod";

export const trainingGoals = ["strength", "hypertrophy", "recomp", "general"] as const;
export const bodyGoalMuscles = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;
export const goalAnalysisSchema = z.object({
  summary: z.string().min(8).max(500),
  focusMuscles: z
    .array(z.enum(bodyGoalMuscles))
    .max(4)
    .transform((values) => [...new Set(values)]),
  trainingNotes: z.array(z.string().min(5).max(300)).max(3),
  limitations: z.string().min(8).max(400),
});
export const bodyComparisonSchema = goalAnalysisSchema.extend({
  trainingGoal: z.enum(trainingGoals),
  focusMuscles: z
    .array(z.enum(bodyGoalMuscles))
    .min(1)
    .max(4)
    .transform((values) => [...new Set(values)]),
});
export type GoalAnalysis = z.infer<typeof goalAnalysisSchema>;
export type BodyComparison = z.infer<typeof bodyComparisonSchema>;
export type BodyGoalScan = BodyComparison & { id: number };

export const goalPhotoSchema = z.string().max(1_500_000);
export const comparePhotosSchema = z.object({
  currentImage: goalPhotoSchema,
  goalImage: goalPhotoSchema,
});

/** Validate bytes as well as the data URL before forwarding a photo to the provider. */
export function parseGoalPhoto(image: string) {
  const match = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    image,
  );
  const error = "Choose a valid JPEG, PNG, or WebP photo under 1 MB after preparation.";
  if (!match || image.length > 1_500_000 || match[2].length % 4 !== 0) throw new Error(error);
  let bytes: string;
  try {
    bytes = atob(match[2]);
  } catch {
    throw new Error(error);
  }
  if (bytes.length > 1_000_000) throw new Error(error);
  const mimeType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  const signature = [...bytes.slice(0, 12)].map((char) => char.charCodeAt(0));
  const valid =
    mimeType === "image/jpeg"
      ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
      : mimeType === "image/png"
        ? signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  if (!valid) throw new Error(error);
  return { mimeType, data: match[2] };
}
