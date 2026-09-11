export type Profile = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  sex: string | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  units: "metric" | "imperial";
  experience: string | null;
  goal: string | null;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: string[];
  injuries: string;
  availableDays: number[];
  focusMuscles: string[];
  onboardedAt: string | null;
  plan: "free" | "pro" | "pro_max";
};

export type PlanExercise = {
  id: number;
  exerciseId: string | null;
  exerciseName: string;
  sets: number;
  reps: string;
  restSec: number;
  targetRpe: number | null;
  notes: string;
  sortOrder: number;
};

export type PlanDay = {
  id: number;
  weekday: number;
  title: string;
  isRest: boolean;
  coachNotes: string;
  exercises: PlanExercise[];
};

export type ActivePlan = {
  id: number;
  title: string;
  split: string;
  daysPerWeek: number;
  focus: string;
  notes: string;
  aiRationale: string;
  days: PlanDay[];
};

export type SessionSet = {
  id: number;
  exerciseId: string | null;
  exerciseName: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
  isWarmup: boolean;
  isPr: boolean;
};

export type WorkoutSession = {
  id: number;
  userId: string;
  title: string;
  planDayId: number | null;
  startedAt: string;
  completedAt: string | null;
  durationSec: number | null;
  bodyweightKg: number | null;
  energy: number | null;
  soreness: number | null;
  notes: string;
  visibility: string;
  volumeKg: number;
  setCount: number;
  prCount: number;
  photoUrl: string | null;
  sets: SessionSet[];
};
