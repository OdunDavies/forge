import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateFirstPlan } from "@/lib/api/plan";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { FOCUS_MUSCLES } from "@/lib/muscles";
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

function determineSplit(days: number, exp: string) {
  if (days <= 3) return "full-body";
  if (days === 4) return "upper-lower";
  if (days >= 3 && days <= 6) {
    if (exp === "advanced" && days >= 5) return "bro-split";
    return "push-pull-legs";
  }
  return "push-pull-legs";
}

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
  const [displayName, setDisplayName] = useState("");
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
  const [error, setError] = useState<string | null>(null);

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
          focusMuscles,
          markOnboarded: true,
        },
      });
      return generateFirstPlan();
    },
    onSuccess: async () => {
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
  if (profileQ.data?.onboardedAt) return <Navigate to="/today" />;

  const steps = [
    {
      title: "What should we call you?",
      body: (
        <div className="space-y-2">
          <Label htmlFor="dn">Name</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="First name" />
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
      title: "What do you want to build most?",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pick up to four. The week will bias volume here.</p>
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
                  key={`${d}-${i}`}
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
          <div className="flex gap-2">
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={cn(
                  "h-10 flex-1 rounded-md text-sm capitalize",
                  units === u ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {u}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bodyweight ({units === "imperial" ? "lb" : "kg"})</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Height ({units === "imperial" ? "in" : "cm"})</Label>
              <Input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Anything we should protect?",
      body: (
        <div className="space-y-2">
          <Label htmlFor="inj">Injuries or limitations</Label>
          <Textarea
            id="inj"
            placeholder="Left shoulder pinch on overhead work, cranky knees on deep squats…"
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
          />
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;
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
                : true;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <Wordmark />
      <div className="mt-8 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
<h1 className="display mt-8 text-3xl font-semibold">{steps[step].title}</h1>
          <div className="mt-6 flex-1">{steps[step].body}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Selected split: <span className="font-medium">{determineSplit(daysPerWeek, experience)}</span>
          </div>
          {error && <p className="mb-3 text-sm text-signal">{error}</p>}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={save.isPending || !stepReady}
          onClick={() => {
            if (!last) setStep((s) => s + 1);
            else save.mutate();
          }}
        >
          {save.isPending
            ? "Reading your goals → Balancing muscle groups → Writing your first block"
            : last ? "Build my plan" : "Continue"}
        </Button>
      </div>
    </main>
  );
}
