import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPersonalRecords, listMyHistory } from "@/lib/api/sessions";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { generateFirstPlan } from "@/lib/api/plan";
import { FOCUS_MUSCLES } from "@/lib/muscles";
import { cn, formatKg, formatDuration, kgFromInput } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { draftFromProfile, measurementInput, stepError } from "@/lib/onboarding";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const qc = useQueryClient();
  const { user, isPending } = useCurrentUserState();
  const me = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user) && !isPending,
  });
  const history = useQuery({
    queryKey: ["history"],
    queryFn: () => listMyHistory(),
    enabled: Boolean(user) && !isPending,
  });
  const prs = useQuery({
    queryKey: ["prs"],
    queryFn: () => getPersonalRecords(),
    enabled: Boolean(user) && !isPending,
  });
  const GOALS = [
    { id: "strength", label: "Get stronger" },
    { id: "hypertrophy", label: "Build muscle" },
    { id: "recomp", label: "Recomp" },
    { id: "general", label: "Stay athletic" },
  ];
  const EXPS = [
    { id: "beginner", label: "Beginner" },
    { id: "intermediate", label: "Intermediate" },
    { id: "advanced", label: "Advanced" },
  ];
  const EQUIP = [
    "barbell",
    "dumbbell",
    "kettlebells",
    "machine",
    "cable",
    "bands",
    "body only",
    "full gym",
  ];
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

  const [focusMuscles, setFocusMuscles] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [units, setUnitsState] = useState<"metric" | "imperial">("metric");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [injuries, setInjuries] = useState("");
  const submitting = useRef(false);
  const hydratedUser = useRef<string | null>(null);

  useEffect(() => {
    const d = me.data;
    if (!d || hydratedUser.current === d.userId) return;
    hydratedUser.current = d.userId;
    setFocusMuscles(d.focusMuscles ?? []);
    setGoal(d.goal ?? "");
    setExperience(d.experience ?? "");
    setEquipment(d.equipment ?? []);
    setAvailableDays(d.availableDays ?? []);
    setSessionMinutes(d.sessionMinutes ?? 60);
    setUnitsState(d.units ?? "metric");
    setWeight(measurementInput(d.weightKg, d.units === "imperial" ? 2.20462 : 1));
    setHeight(measurementInput(d.heightCm, d.units === "imperial" ? 1 / 2.54 : 1));
    setDisplayName(d.displayName ?? "");
    setBio(d.bio ?? "");
    setInjuries(d.injuries ?? "");
  }, [me.data]);

  const save = useMutation({
    mutationFn: async (rebuild: boolean) => {
      if (!me.data || !user) throw new Error("Load your profile before saving.");
      if (!displayName.trim() || displayName.trim().length > 60)
        throw new Error("Name must contain 1 to 60 characters.");
      if (bio.length > 280) throw new Error("Keep your bio under 280 characters.");
      const draft = {
        ...draftFromProfile(me.data),
        goal,
        experience,
        equipment,
        focusMuscles,
        availableDays,
        sessionMinutes,
        units,
        weight,
        height,
        injuries,
      };
      for (const step of [1, 2, 3, 4, 5, 6]) {
        const error = stepError(draft, step);
        if (error) throw new Error(error);
      }
      const weightKg = weight.trim() ? kgFromInput(Number(weight), units) : null;
      const heightCm = height.trim()
        ? units === "imperial"
          ? Number(height) * 2.54
          : Number(height)
        : null;
      const updated = await upsertMyProfile({
        data: {
          displayName: displayName.trim(),
          bio,
          injuries,
          focusMuscles,
          goal,
          experience,
          equipment,
          availableDays,
          daysPerWeek: availableDays.length,
          sessionMinutes,
          units,
          weightKg,
          heightCm,
        },
      });
      qc.setQueryData(["me", user.id], updated);
      qc.setQueryData(["me"], updated);
      if (rebuild) {
        const { plan } = await generateFirstPlan();
        if (!plan)
          throw new Error("Your profile was saved, but the plan could not be rebuilt. Try again.");
        qc.setQueryData(["plan"], plan);
        await qc.invalidateQueries({ queryKey: ["plan"] });
      }
    },
    onSuccess: (_, rebuild) =>
      toast(rebuild ? "Profile saved and plan rebuilt" : "Profile updated"),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      submitting.current = false;
    },
  });

  const submit = (rebuild: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    save.mutate(rebuild);
  };
  const changeUnits = (next: "metric" | "imperial") => {
    if (next === units) return;
    const imperial = next === "imperial";
    if (weight.trim() && Number.isFinite(Number(weight)))
      setWeight(measurementInput(Number(weight), imperial ? 2.20462 : 1 / 2.20462));
    if (height.trim() && Number.isFinite(Number(height)))
      setHeight(measurementInput(Number(height), imperial ? 1 / 2.54 : 2.54));
    setUnitsState(next);
  };

  const p = me.data;
  const displayUnits = p?.units ?? "metric";

  if (isPending || !user || me.isPending) return <p role="status">Loading your profile...</p>;
  if (me.isError)
    return (
      <div className="space-y-4">
        <p role="alert">Could not load your profile. {me.error.message}</p>
        <Button onClick={() => void me.refetch()} disabled={me.isFetching}>
          Retry
        </Button>
      </div>
    );
  if (!p) return <p role="alert">Complete onboarding before editing your profile.</p>;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            @{p?.handle}
          </p>
          <h1 className="display text-3xl font-semibold">{p?.displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {p?.goal} · {p?.experience} · {p?.daysPerWeek} days
          </p>
        </div>
        <UserButton />
      </header>

      <Link
        to="/goal-scan"
        className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ScanLine className="size-5" />
        </span>
        <span>
          <strong className="block text-sm">Scan a goal physique</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            Turn a reference photo into training priorities and update your plan.
          </span>
        </span>
      </Link>

      <div className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Training preferences
        </p>
        <fieldset disabled={save.isPending} className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Athlete"
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Train like a mission"
              maxLength={280}
            />
          </div>
          <div className="space-y-2">
            <Label>Goal</Label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm",
                    goal === g.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Experience</Label>
            <div className="flex flex-wrap gap-2">
              {EXPS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setExperience(e.id)}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm",
                    experience === e.id ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Build these most (up to 4)</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_MUSCLES.map((m) => {
                const on = focusMuscles.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setFocusMuscles((prev) =>
                        on
                          ? prev.filter((x) => x !== m.id)
                          : prev.length >= 4
                            ? prev
                            : [...prev, m.id],
                      )
                    }
                    className={cn(
                      "h-10 rounded-full px-3 text-sm",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Equipment</Label>
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
                      "h-10 rounded-full px-3 text-sm capitalize",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {eq}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>When do you train?</Label>
            <div className="flex gap-1.5">
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
                      "size-9 rounded-full text-sm",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Minutes / session</Label>
              <Input
                type="number"
                min={20}
                max={180}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Units</Label>
              <div className="flex gap-2">
                {(["metric", "imperial"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={units === u}
                    onClick={() => changeUnits(u)}
                    className={cn(
                      "h-10 flex-1 rounded-md text-sm capitalize",
                      units === u ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profile-weight">
                Bodyweight ({units === "imperial" ? "lb" : "kg"})
              </Label>
              <Input
                id="profile-weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-height">Height ({units === "imperial" ? "in" : "cm"})</Label>
              <Input
                id="profile-height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-injuries">Injuries</Label>
            <Textarea
              id="profile-injuries"
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              maxLength={500}
              placeholder="Left shoulder pinch…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submit(false)} disabled={save.isPending}>
              {save.isPending && !save.variables ? "Saving..." : "Save profile"}
            </Button>
            <Button variant="outline" onClick={() => submit(true)} disabled={save.isPending}>
              {save.isPending && save.variables ? "Saving & rebuilding..." : "Save & rebuild plan"}
            </Button>
          </div>
        </fieldset>
        {save.isPending && (
          <p role="status">
            {save.variables
              ? "Saving your profile and rebuilding your plan..."
              : "Saving your profile..."}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-signal">
            {save.error.message}
          </p>
        )}
      </div>

      <section>
        <h2 className="display text-xl font-semibold">Personal records</h2>
        <ul className="mt-3 space-y-2">
          {(prs.data ?? []).slice(0, 12).map((r) => (
            <li key={r.exerciseName} className="flex justify-between gap-3 text-sm">
              <span>{r.exerciseName}</span>
              <span className="tabular text-muted-foreground">
                {formatKg(r.weightKg, displayUnits)} × {r.reps}
              </span>
            </li>
          ))}
          {(prs.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              PRs appear when a logged set beats your best e1RM.
            </p>
          )}
        </ul>
      </section>

      <section>
        <h2 className="display text-xl font-semibold">Recent sessions</h2>
        <ul className="mt-3 space-y-2">
          {(history.data ?? []).map((s) => (
            <li key={s.id}>
              <Link
                to="/session/$id"
                params={{ id: String(s.id) }}
                className="flex items-center justify-between rounded-md bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]"
              >
                <span>{s.title}</span>
                <span className="tabular text-muted-foreground">
                  {formatKg(s.volumeKg, displayUnits)} · {formatDuration(s.durationSec)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Button variant="ghost" className="mt-3" asChild>
          <Link to="/history">Full history</Link>
        </Button>
      </section>
    </div>
  );
}
