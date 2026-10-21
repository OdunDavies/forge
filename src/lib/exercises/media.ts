import manifest from "../../data/exercise-media.json" with { type: "json" };

export type ExerciseDemo = {
  name: string;
  videos: string[];
  poster: string | null;
  baseExercise: string | null;
};

const demos: Record<string, Omit<ExerciseDemo, "baseExercise">> = manifest.demos;
const exercises: Record<string, { demo: string; baseExercise: string | null }> = manifest.exercises;

export const VIDEO_EXERCISE_IDS = Object.keys(exercises);

export function getExerciseDemo(id: string): ExerciseDemo | null {
  const entry = exercises[id];
  const demo = entry && demos[entry.demo];
  return demo ? { ...demo, baseExercise: entry.baseExercise } : null;
}
