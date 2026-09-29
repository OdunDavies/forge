import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateFirstPlan } from "@/lib/api/plan";
import { track } from "@/lib/analytics";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { FOCUS_MUSCLES } from "@/lib/muscles";
import { determineSplit } from "@/lib/plan/fallback";
import { cn, kgFromInput } from "@/lib/utils";

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
  const me = useCurrentUser();
  const navigate = useNavigate();
  const profileQ = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [goal, setGoal] = useState("");
  const [focusMuscles, setFocusMuscles] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [units, setUnits] = useState<"metric" | "imperial" | "">("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [injuries, setInjuries] = useState("");
  const [sex, setSex] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [squat, setSquat] = useState("");
  const [bench, setBench] = useState("");
  const [deadlift, setDeadlift] = useState("");
  const [overheadPress, setOverheadPress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // restore draft v2
  useEffect(() => {
    try {
      const raw = localStorage.getItem("forge-onboarding-draft-v2");
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.displayName === "string") setDisplayName(d.displayName);
      if (typeof d.goal === "string") setGoal(d.goal);
      if (Array.isArray(d.focusMuscles)) setFocusMuscles(d.focusMuscles as string[]);
      if (typeof d.experience === "string") setExperience(d.experience);
      if (Array.isArray(d.equipment)) setEquipment(d.equipment as string[]);
      if (Array.isArray(d.availableDays)) setAvailableDays(d.availableDays as number[]);
      if (typeof d.sessionMinutes === "number") setSessionMinutes(d.sessionMinutes);
      if (d.units === "metric" || d.units === "imperial") setUnits(d.units);
      if (typeof d.weight === "string") setWeight(d.weight);
      if (typeof d.height === "string") setHeight(d.height);
      if (typeof d.injuries === "string") setInjuries(d.injuries);
      if (typeof d.sex === "string") setSex(d.sex === "prefer-not-to-say" ? null : d.sex);
      if (typeof d.birthYear === "number") setBirthYear(d.birthYear);
      if (typeof d.squat === "string") setSquat(d.squat);
      if (typeof d.bench === "string") setBench(d.bench);
      if (typeof d.deadlift === "string") setDeadlift(d.deadlift);
      if (typeof d.overheadPress === "string") setOverheadPress(d.overheadPress);
      // clamp step to valid range [0, steps.length-1]
      if (typeof d.step === "number") setStep(Math.min(8, Math.max(0, d.step)));
    } catch { /* ignore */ }
  }, []);

  // autosave draft v2
  useEffect(() => {
    try {
      localStorage.setItem(
        "forge-onboarding-draft-v2",
        JSON.stringify({ displayName, goal, focusMuscles, experience, equipment, availableDays, sessionMinutes, units, weight, height, injuries, sex, birthYear, squat, bench, deadlift, overheadPress, step }),
      );
    } catch { /* ignore */ }
  }, [displayName, goal, focusMuscles, experience, equipment, availableDays, sessionMinutes, units, weight, height, injuries, sex, birthYear, squat, bench, deadlift, overheadPress, step]);

  const save = useMutation({
    mutationFn: async () => {
      const measure = units === "imperial" ? "imperial" : "metric";
      const weightKg = weight ? kgFromInput(Number(weight), measure) : null;
      const heightCm = height
        ? measure === "imperial"
          ? Number(height) * 2.54
          : Number(height)
        : null;
      const days = availableDays.length >= 2 ? availableDays : [1, 2, 3, 4];
      await upsertMyProfile({
        data: {
          displayName: displayName.trim() || me?.displayName || "Athlete",
          goal: goal || "strength",
          experience: experience || "intermediate",
          equipment: equipment.length ? equipment : ["body only"],
          availableDays: days,
          daysPerWeek: days.length,
          sessionMinutes,
          units: measure,
          weightKg,
          heightCm,
          injuries,
          sex:
            sex === "prefer-not-to-say" ? null : sex,
          birthYear:
            birthYear ?? null,
          baseline_lifts: {
            squat: squat ? Number(squat) : null,
            bench: bench ? Number(bench) : null,
            deadlift: deadlift ? Number(deadlift) : null,
            overheadPress: overheadPress ? Number(overheadPress) : null,
          },
        },
      });
      return generateFirstPlan();
    },
    onSuccess: async () => {
      track("onboarding_plan_built", {
        source: "onboarding",
        displayName: displayName.trim() || "Athlete",
        goal,
        hasBaselineLifts: !!(
          squat || bench || deadlift || overheadPress
        ),
      });
      try { localStorage.removeItem("forge-onboarding-draft-v2"); } catch { /* ignore */ }
      await navigate({ to: "/today" });
    },
    onError: (e: Error) => {
      const msg = e.message || "Could not build your plan";
      if (/unauthorized|deferSessionRefresh|method not allowed/i.test(msg)) {
        setError("Your session dropped. Sign in again, then tap Build my plan.");
        return;
      }
      setError(msg);
    },
  });

  if (isPending || profileQ.isPending) return <div className="min-h-dvh bg-background" />;
  if (!user) return <RedirectToSignIn />;
  if (profileQ.data?.onboardedAt) return <Navigate to="/today" />

  // step readiness based on completed steps
  const stepReady =
    step === 0
      ? true
      : step === 1
      ? Boolean(goal)
      : step === 2
      ? focusMuscles.length > 0
      : step === 3
      ? Boolean(experience)
      : step === 4
      ? equipment.length > 0
      : step === 5
      ? availableDays.length >= 2
      : step === 6
      ? units.length > 0
      : step === 7
      ? true
      : true;

  // track step viewed events
  useEffect(() => {
    track("onboarding_baseline_skipped", {
      source: "onboarding",
      step: step + 1,
    });
  }, [step]);

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
              <Label htmlFor="sex">Sex</Label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSex("male")}
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
                  key={`${d}`}
                  type="button"
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
              <Label>Minutes</Label>
              <Input
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bodyweight ({units === "imperial" ? "lb" : "kg"})</Label>
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Height ({units === "imperial" ? "in" : "cm"})</Label>
              <Input
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Birth year</Label>
              <Input
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
              <Label>Squat (kg)</Label>
              <Input
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
              <Label>Bench (kg)</Label>
              <Input
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
              <Label>Deadlift (kg)</Label>
              <Input
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
              <Label>Overhead press (kg)</Label>
              <Input
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
              onClick={() => setStep(i)}
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
      <div className="mt-6 flex-1">{steps[step].body}</div>
      {availableDays.length >= 2 && experience ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Split: <span className="font-medium text-foreground">
            {determineSplit(availableDays.length, experience, focusMuscles, goal)}
          </span>
          {focusMuscles.length ? ` · 40% of sets on ${focusMuscles.join(" + ")}` : ""}
        </p>
      ) : null}
      {error && <p className="mb-3 text-sm text-signal">{error}</p>}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={save.isPending || !stepReady}
          onClick={() => {
            if (!last) setStep((s) => Math.min(maxValidStep, s + 1));
            else save.mutate();
          }}
        >
          {last ? "Build my plan" : "Continue"}
        </Button>
      </div>
    </main>
  );
}