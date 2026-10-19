import { z } from "zod";

export const planExerciseSchema = z.object({
  exerciseId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  sets: z.number().int().min(1).max(8),
  reps: z.string().trim().min(1).max(40),
  restSec: z.number().int().min(0).max(400).optional(),
  rpe: z.number().min(5).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export const generatedSchema = z.object({
  title: z.string().trim().min(1),
  split: z.string().optional(),
  focus: z.string().optional(),
  rationale: z.string().optional(),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        title: z.string().trim().min(1),
        isRest: z.boolean().optional(),
        notes: z.string().optional(),
        exercises: z.array(planExerciseSchema).max(8).optional(),
      }),
    )
    .min(1)
    .max(7)
    .refine(
      (days) => new Set(days.map((d) => d.weekday)).size === days.length,
      "Weekdays must be unique",
    ),
});

export const confirmTweakSchema = z.object({
  exercises: z.array(planExerciseSchema).min(1).max(8),
  message: z.string().max(2000).optional(),
  targetWeekday: z.number().int().min(0).max(6).optional(),
});

export type GeneratedPlan = z.infer<typeof generatedSchema>;
export type GeneratedExercise = z.infer<typeof planExerciseSchema>;
