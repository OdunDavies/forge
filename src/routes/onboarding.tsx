import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateFirstPlan } from "@/lib/api/plan";
import { track } from "@/lib/analytics";
import { getMyProfile, upsertMyProfile, type Profile } from "@/lib/api/profile";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { FOCUS_MUSCLES } from "@/lib/muscles";
import { determineSplit } from "@/lib/plan/fallback";
import { cn } from "@/lib/utils";
import { draftKey, draftFromProfile, restoreDraft, stepError, firstInvalidStep, profilePayload, measurementInput, type OnboardingDraft } from "@/lib/onboarding";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const GOALS = [
  { id: "strength", label: "Get stronger" },
  { id: "hypertrophy", label: "Build muscle" },
  { id: "recomp", label: "Recomp" },
  { id: "general", label: "Stay athletic" },
];
const EXP = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];
const EQUIP = ["barbell", "dumbbell", "kettlebells", "machine", "cable", "bands", "body only", "full gym"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function Onboarding() {
  const { user, isPending } = useCurrentUserState();
  const profileQ = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user) && !isPending,
  });

  if (isPending) return <main role="status" className="p-8">Loading your account...</main>;
  if (!user) return <RedirectToSignIn />;
  if (profileQ.isPending) return <main role="status" className="p-8">Loading your profile...</main>;
  if (profileQ.isError) return (
    <main className="space-y-4 p-8">
      <p role="alert">Could not load your profile. {profileQ.error.message}</p>
      <Button onClick={() => void profileQ.refetch()} disabled={profileQ.isFetching}>Retry</Button>
    </main>
  );
  if (profileQ.data?.onboardedAt) return <Navigate to="/today" />;
  return <OnboardingForm key={user.id} user={user} profile={profileQ.data} />;
}

function OnboardingForm({ user: me, profile }: { user: AppUser; profile: Profile | null | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitting = useRef(false);
  const [draft, setDraft] = useState(() => {
    const base = draftFromProfile(profile);
    try { return restoreDraft(localStorage.getItem(draftKey(me.id)), base); }
    catch { return base; }
  });
  const { step, goal, focusMuscles, experience, equipment, availableDays, sessionMinutes, units, weight, height, injuries, sex, birthYear, squat, bench, deadlift, overheadPress } = draft;
  const field = <K extends keyof OnboardingDraft>(key: K) => (value: OnboardingDraft[K] | ((previous: OnboardingDraft[K]) => OnboardingDraft[K])) => {
    setDraft((previous) => ({ ...previous, [key]: typeof value === "function" ? value(previous[key]) : value }));
  };
  const setStep = field("step"), setGoal = field("goal"), setFocusMuscles = field("focusMuscles"), setExperience = field("experience");
  const setEquipment = field("equipment"), setAvailableDays = field("availableDays"), setSessionMinutes = field("sessionMinutes");
  const setWeight = field("weight"), setHeight = field("height"), setInjuries = field("injuries"), setSex = field("sex"), setBirthYear = field("birthYear");
  const setSquat = field("squat"), setBench = field("bench"), setDeadlift = field("deadlift"), setOverheadPress = field("overheadPress");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(draftKey(me.id), JSON.stringify(draft)); }
    catch { /* Storage may be unavailable. */ }
  }, [draft, me.id]);

  const save = useMutation({
    mutationFn: async () => {
      const data = profilePayload(draft, me.displayName);
      await upsertMyProfile({ data });
      const plan = await generateFirstPlan();
      if (!plan) throw new Error("Could not build your plan. Please try again.");
      const completed = await upsertMyProfile({ data: { displayName: data.displayName, markOnboarded: true } });
      return { profile: completed, plan };
    },
    onSuccess: async ({ profile: completed, plan }) => {
      qc.setQueryData(["me", me.id], completed);
      qc.setQueryData(["me"], completed);
      qc.setQueryData(["plan"], plan);
      track("onboarding_plan_built", {
        source: "onboarding",
        goal,
        hasBaselineLifts: !!(
          squat || bench || deadlift || overheadPress
        ),
      });
      try { localStorage.removeItem(draftKey(me.id)); } catch { /* ignore */ }
      await navigate({ to: "/today" });
    },
    onError: (e: Error) => {
      submitting.current = false;
      const msg = e.message || "Could not build your plan";
      if (/unauthorized|deferSessionRefresh|method not allowed/i.test(msg)) {
        setError("Your session dropped. Sign in again, then tap Build my plan.");
        return;
      }
      setError(msg);
    },
  });

  const validationError = stepError(draft, step);
  const stepReady = !validationError;
  const changeUnits = (next: "metric" | "imperial") => {
    if (units && units !== next) {
      const toImperial = next === "imperial";
      setDraft((d) => ({ ...d, units: next,
        weight: d.weight.trim() && Number.isFinite(Number(d.weight)) ? measurementInput(Number(d.weight), toImperial ? 2.20462 : 1 / 2.20462) : d.weight,
        height: d.height.trim() && Number.isFinite(Number(d.height)) ? measurementInput(Number(d.height), toImperial ? 1 / 2.54 : 2.54) : d.height,
      }));
    } else field("units")(next);
  };

  const steps = [
    {
      title: me?.displayName ? `Welcome ${me.displayName}` : "Welcome",
      body: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {me?.displayName && (
              <>
                Welcome {me.displayName}, let's continue setting up your profile.
              </>
            )}
            {!(me?.displayName) && (
              <>Let's get you set up with a profile.</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
               <Label id="sex-label">Sex</Label>
               <div role="group" aria-labelledby="sex-label" className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSex("male")}
                  aria-pressed={sex === "male"}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium shadow-[var(--shadow-border)]",
                    sex === "male" ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setSex("female")}
                  aria-pressed={sex === "female"}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium shadow-[var(--shadow-border)]",
                    sex === "female" ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setSex("prefer-not-to-say")}
                  aria-pressed={sex === "prefer-not-to-say"}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium shadow-[var(--shadow-border)]",
                    sex === "prefer-not-to-say" ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  Prefer not to say
                </button>
              </div>
            </div>
          </div>
          {sex && sex !== "prefer-not-to-say" && (
            <p className="text-xs text-muted-foreground">
              {`Birth year: ${birthYear ?? "not specified"}`}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "What's the mission?",
      body: (
        <div className="grid gap-2">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={cn(
                "h-12 rounded-md px-4 text-left text-sm font-medium shadow-[var(--shadow-border)]",
                goal === g.id ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Which muscles to focus?",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick up to four. The week will bias volume here.
          </p>
          <div className="flex flex-wrap gap-2">
            {FOCUS_MUSCLES.map((m) => {
              const on = focusMuscles.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setFocusMuscles((prev) => {
                      if (on) return prev.filter((x) => x !== m.id);
                      if (prev.length >= 4) return prev;
                      return [...prev, m.id];
                    })
                  }
                  className={cn(
                    "h-11 rounded-full px-4 text-sm shadow-[var(--shadow-border)]",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      title: "Training age",
      body: (
        <div className="grid gap-2">
          {EXP.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setExperience(g.id)}
              className={cn(
                "h-12 rounded-md px-4 text-left text-sm font-medium shadow-[var(--shadow-border)]",
                experience === g.id ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "What can you train with?",
      body: (
        <div className="flex flex-wrap gap-2">
          {EQUIP.map((eq) => {
            const on = equipment.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                onClick={() =>
                  setEquipment((prev) => (on ? prev.filter((x) => x !== eq) : [...prev, eq]))
                }
                className={cn(
                  "h-11 rounded-full px-4 text-sm capitalize shadow-[var(--shadow-border)]",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {eq}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "When do you train?",
      body: (
        <div className="space-y-6">
          <div className="flex gap-2">
            {DAYS.map((d, i) => {
              const on = availableDays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}
                  aria-pressed={on}
                  onClick={() =>
                    setAvailableDays((prev) =>
                      on ? prev.filter((x) => x !== i) : [...prev, i].sort(),
                    )
                  }
                  className={cn(
                    "size-11 rounded-full text-sm font-medium",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Training days</Label>
              <p className="h-11 content-center rounded-md bg-secondary px-3 text-sm tabular">
                {availableDays.length || "—"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-minutes">Minutes</Label>
              <Input
                id="session-minutes"
                type="number"
                min={20}
                max={180}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Optional vitals",
      body: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label id="units-label">Units</Label>
            <div role="group" aria-labelledby="units-label" className="flex gap-2">
              {(["metric", "imperial"] as const).map((u) => (
                <button key={u} type="button" aria-pressed={units === u} onClick={() => changeUnits(u)} className={cn("h-11 flex-1 rounded-md px-3 text-sm capitalize", units === u ? "bg-primary text-primary-foreground" : "bg-secondary")}>{u}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bodyweight">Bodyweight ({units === "imperial" ? "lb" : "kg"})</Label>
              <Input
                id="bodyweight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <Label htmlFor="height">Height ({units === "imperial" ? "in" : "cm"})</Label>
              <Input
                id="height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="birth-year">Birth year</Label>
              <Input
                id="birth-year"
                type="number"
                min={1940}
                max={2015}
                value={birthYear !== null ? String(birthYear) : ""}
                onChange={(e) =>
                  setBirthYear(
                    e.target.value !== "" ? Number(e.target.value) : null
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="injuries">Injuries or limitations</Label>
            <Textarea id="injuries" value={injuries} onChange={(e) => setInjuries(e.target.value)} maxLength={500} placeholder="Anything your plan should work around" />
          </div>
          {sex && sex !== "prefer-not-to-say" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {`Birth year: ${birthYear ?? "not specified"}`}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Current best lifts",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your current estimated 1RMs will help us start you at the right weight.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <Label htmlFor="squat">Squat (kg)</Label>
              <Input
                id="squat"
                value={squat}
                onChange={(e) => setSquat(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 100"
              />
              <p className="text-xs text-muted-foreground">
                Your current estimated 1RM for squat
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="bench">Bench (kg)</Label>
              <Input
                id="bench"
                value={bench}
                onChange={(e) => setBench(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 60"
              />
              <p className="text-xs text-muted-foreground">
                Your current estimated 1RM for bench
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <Label htmlFor="deadlift">Deadlift (kg)</Label>
              <Input
                id="deadlift"
                value={deadlift}
                onChange={(e) => setDeadlift(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 120"
              />
              <p className="text-xs text-muted-foreground">
                Your current estimated 1RM for deadlift
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="overhead-press">Overhead press (kg)</Label>
              <Input
                id="overhead-press"
                value={overheadPress}
                onChange={(e) => setOverheadPress(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 40"
              />
              <p className="text-xs text-muted-foreground">
                Your current estimated 1RM for overhead press
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  // derive max valid step from steps.length (8 steps = indices 0-7)
  const maxValidStep = steps.length - 1;
  const last = step === steps.length - 1;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <Wordmark />
      <div className="mt-8 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {steps.map((_, i) => {
          // only allow stepping back to visited steps (index <= step)
          const isVisited = i <= step;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? "step" : undefined}
              disabled={save.isPending || i > firstInvalidStep(draft)}
              onClick={() => { setError(null); setStep(i); }}
              className={cn(
                "size-2 rounded-full transition-colors",
                isVisited ? "bg-primary" : "bg-secondary",
                i === step ? "ring-2 ring-primary" : "",
              )}
            />
          );
        })}
      </div>
      <h1 className="display mt-8 text-3xl font-semibold">
        {steps[step].title}
      </h1>
      <fieldset disabled={save.isPending} className="mt-6 flex-1">{steps[step].body}</fieldset>
      {availableDays.length >= 2 && experience ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Split: <span className="font-medium text-foreground">
            {determineSplit(availableDays.length, experience, focusMuscles, goal)}
          </span>
          {focusMuscles.length ? ` · 40% of sets on ${focusMuscles.join(" + ")}` : ""}
        </p>
      ) : null}
      {validationError && <p role="status" className="mb-3 text-sm text-muted-foreground">{validationError}</p>}
      {error && <p role="alert" className="mb-3 text-sm text-signal">{error}</p>}
      {save.isPending && <p role="status" className="mb-3 text-sm">Building your plan...</p>}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" disabled={save.isPending} className="flex-1" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }}>
            Back
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={save.isPending || !stepReady}
          onClick={() => {
            if (submitting.current) return;
            setError(null);
            if (!last) {
              if (stepReady) setStep((s) => Math.min(maxValidStep, s + 1));
            } else {
              const invalid = firstInvalidStep(draft);
              if (invalid < steps.length) {
                setStep(invalid);
                setError(stepError(draft, invalid));
                return;
              }
              submitting.current = true;
              save.mutate();
            }
          }}
        >
          {save.isPending ? "Building your plan..." : last ? "Build my plan" : "Continue"}
        </Button>
      </div>
    </main>
  );
}
