import type { Profile } from "./api/types";
import { FOCUS_MUSCLES } from "./muscles";

export const ONBOARDING_STEPS = 8;
export const EQUIPMENT = ["barbell", "dumbbell", "kettlebells", "machine", "cable", "bands", "body only", "full gym"];
export const draftKey = (userId: string) => `forge-onboarding-draft-v3:${encodeURIComponent(userId)}`;

export type OnboardingDraft = {
  step: number;
  goal: string;
  focusMuscles: string[];
  experience: string;
  equipment: string[];
  availableDays: number[];
  sessionMinutes: number;
  units: "metric" | "imperial" | "";
  weight: string;
  height: string;
  injuries: string;
  sex: "male" | "female" | "prefer-not-to-say" | "";
  birthYear: number | null;
  squat: string;
  bench: string;
  deadlift: string;
  overheadPress: string;
};

export const emptyDraft = (): OnboardingDraft => ({
  step: 0, goal: "", focusMuscles: [], experience: "", equipment: [],
  availableDays: [], sessionMinutes: 60, units: "", weight: "", height: "",
  injuries: "", sex: "", birthYear: null, squat: "", bench: "", deadlift: "", overheadPress: "",
});

export function measurementInput(value: number | null | undefined, factor = 1): string {
  return value == null ? "" : String(Math.round(value * factor * 1000) / 1000);
}

export function draftFromProfile(profile: Profile | null | undefined): OnboardingDraft {
  if (!profile) return emptyDraft();
  const imperial = profile.units === "imperial";
  return {
    ...emptyDraft(), goal: profile.goal ?? "", experience: profile.experience ?? "",
    focusMuscles: profile.focusMuscles, equipment: profile.equipment,
    availableDays: profile.availableDays, sessionMinutes: profile.sessionMinutes,
    units: profile.units, weight: measurementInput(profile.weightKg, imperial ? 2.20462 : 1),
    height: measurementInput(profile.heightCm, imperial ? 1 / 2.54 : 1),
    injuries: profile.injuries, sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : "prefer-not-to-say",
    birthYear: profile.birthYear,
    squat: measurementInput(profile.baseline_lifts?.squat), bench: measurementInput(profile.baseline_lifts?.bench),
    deadlift: measurementInput(profile.baseline_lifts?.deadlift), overheadPress: measurementInput(profile.baseline_lifts?.overheadPress),
  };
}

export function stepError(d: OnboardingDraft, step: number): string | null {
  const optionalNumber = (s: string) => !s.trim() || (Number.isFinite(Number(s)) && Number(s) > 0);
  switch (step) {
    case 0: return ["male", "female", "prefer-not-to-say"].includes(d.sex) ? null : "Choose sex or Prefer not to say.";
    case 1: return ["strength", "hypertrophy", "recomp", "general"].includes(d.goal) ? null : "Choose a goal.";
    case 2: return d.focusMuscles.length >= 1 && d.focusMuscles.length <= 4 && new Set(d.focusMuscles).size === d.focusMuscles.length && d.focusMuscles.every((m) => FOCUS_MUSCLES.some((f) => f.id === m)) ? null : "Choose one to four focus muscles.";
    case 3: return ["beginner", "intermediate", "advanced"].includes(d.experience) ? null : "Choose your training experience.";
    case 4: return d.equipment.length > 0 && d.equipment.every((e) => EQUIPMENT.includes(e)) ? null : "Choose your equipment.";
    case 5: return d.availableDays.length >= 2 && d.availableDays.length <= 7 && new Set(d.availableDays).size === d.availableDays.length && d.availableDays.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) && Number.isInteger(d.sessionMinutes) && d.sessionMinutes >= 20 && d.sessionMinutes <= 180 ? null : "Choose at least two days and 20 to 180 whole minutes per session.";
    case 6:
      if (d.units !== "metric" && d.units !== "imperial") return "Choose metric or imperial units.";
      if (!optionalNumber(d.weight) || !optionalNumber(d.height)) return "Bodyweight and height must be positive numbers or blank.";
      if (d.birthYear !== null && (!Number.isInteger(d.birthYear) || d.birthYear < 1940 || d.birthYear > 2015)) return "Birth year must be between 1940 and 2015, or blank.";
      return d.injuries.length <= 500 ? null : "Keep injuries under 500 characters.";
    case 7: return [d.squat, d.bench, d.deadlift, d.overheadPress].every(optionalNumber) ? null : "Lifts must be positive numbers or blank.";
    default: return "Invalid onboarding step.";
  }
}

export function firstInvalidStep(d: OnboardingDraft): number {
  for (let i = 0; i < ONBOARDING_STEPS; i++) if (stepError(d, i)) return i;
  return ONBOARDING_STEPS;
}

export function restoreDraft(raw: string | null, base = emptyDraft()): OnboardingDraft {
  if (!raw) return base;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return base;
    const record = data as Record<string, unknown>;
    const d = { ...base };
    for (const key of ["goal", "experience", "weight", "height", "injuries", "squat", "bench", "deadlift", "overheadPress"] as const) {
      if (typeof record[key] === "string") d[key] = record[key];
    }
    for (const key of ["focusMuscles", "equipment"] as const) {
      if (Array.isArray(record[key]) && record[key].every((v) => typeof v === "string")) d[key] = [...new Set(record[key])];
    }
    if (Array.isArray(record.availableDays) && record.availableDays.every((n) => typeof n === "number")) d.availableDays = [...new Set(record.availableDays)];
    if (typeof record.sessionMinutes === "number") d.sessionMinutes = record.sessionMinutes;
    if (record.units === "metric" || record.units === "imperial") d.units = record.units;
    if (["male", "female", "prefer-not-to-say"].includes(String(record.sex))) d.sex = record.sex as OnboardingDraft["sex"];
    if (record.birthYear === null || typeof record.birthYear === "number") d.birthYear = record.birthYear;
    // Invalid persisted fields fall back to saved profile values, never bypass validation.
    if (stepError(d, 1)) d.goal = base.goal;
    if (stepError(d, 2)) d.focusMuscles = base.focusMuscles;
    if (stepError(d, 3)) d.experience = base.experience;
    if (stepError(d, 4)) d.equipment = base.equipment;
    if (!d.availableDays.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) d.availableDays = base.availableDays;
    if (!Number.isInteger(d.sessionMinutes) || d.sessionMinutes < 20 || d.sessionMinutes > 180) d.sessionMinutes = base.sessionMinutes;
    for (const key of ["weight", "height", "squat", "bench", "deadlift", "overheadPress"] as const) {
      if (d[key].trim() && (!Number.isFinite(Number(d[key])) || Number(d[key]) <= 0)) d[key] = base[key];
    }
    if (d.birthYear !== null && (!Number.isInteger(d.birthYear) || d.birthYear < 1940 || d.birthYear > 2015)) d.birthYear = base.birthYear;
    if (d.injuries.length > 500) d.injuries = base.injuries;
    const step = typeof record.step === "number" && Number.isInteger(record.step) ? record.step : 0;
    d.step = Math.max(0, Math.min(ONBOARDING_STEPS - 1, step, firstInvalidStep(d)));
    return d;
  } catch { return base; }
}

export function profilePayload(d: OnboardingDraft, authName: string | null | undefined) {
  const invalid = firstInvalidStep(d);
  if (invalid < ONBOARDING_STEPS) throw new Error(stepError(d, invalid)!);
  const numberOrNull = (s: string) => s.trim() ? Number(s) : null;
  const weight = numberOrNull(d.weight);
  const height = numberOrNull(d.height);
  return {
    displayName: authName?.trim().slice(0, 60) || "Athlete",
    goal: d.goal, focusMuscles: d.focusMuscles, experience: d.experience,
    equipment: d.equipment, availableDays: d.availableDays, daysPerWeek: d.availableDays.length,
    sessionMinutes: d.sessionMinutes, units: d.units as "metric" | "imperial",
    weightKg: weight === null ? null : d.units === "imperial" ? weight / 2.20462 : weight,
    heightCm: height === null ? null : d.units === "imperial" ? height * 2.54 : height,
    injuries: d.injuries, sex: d.sex === "prefer-not-to-say" ? null : d.sex as "male" | "female",
    birthYear: d.birthYear,
    baseline_lifts: { squat: numberOrNull(d.squat), bench: numberOrNull(d.bench), deadlift: numberOrNull(d.deadlift), overheadPress: numberOrNull(d.overheadPress) },
  };
}
