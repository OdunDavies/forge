import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPersonalRecords, listMyHistory } from "@/lib/api/sessions";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { generateFirstPlan } from "@/lib/api/plan";
import { coachQuota } from "@/lib/api/billing";
import { FOCUS_MUSCLES } from "@/lib/muscles";
import { cn, formatKg, formatDuration, kgFromInput, displayWeight } from "@/lib/utils";
import {
  formatPrice,
  membershipLabel,
  PLANS,
  useBillingRegion,
  type PaidMembership,
} from "@/lib/billing";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const quota = useQuery({ queryKey: ["coach-quota"], queryFn: () => coachQuota() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => listMyHistory() });
  const prs = useQuery({ queryKey: ["prs"], queryFn: () => getPersonalRecords() });
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
  const EQUIP = ["barbell", "dumbbell", "kettlebells", "machine", "cable", "bands", "body only", "full gym"];
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

  useEffect(() => {
    const d = me.data;
    if (!d) return;
    setFocusMuscles(d.focusMuscles ?? []);
    setGoal(d.goal ?? "");
    setExperience(d.experience ?? "");
    setEquipment(d.equipment ?? []);
    setAvailableDays(d.availableDays ?? []);
    setSessionMinutes(d.sessionMinutes ?? 60);
    setUnitsState(d.units ?? "metric");
    setWeight(d.weightKg != null ? String(Math.round(displayWeight(d.weightKg, d.units ?? "metric") * 10) / 10) : "");
    setHeight(d.heightCm != null ? String(Math.round(d.heightCm)) : "");
    setDisplayName(d.displayName ?? "");
    setBio(d.bio ?? "");
    setInjuries(d.injuries ?? "");
  }, [me.data]);

  const save = useMutation({
    mutationFn: async () => {
      const weightKg = weight ? kgFromInput(Number(weight), units) : null;
      const heightCm = height
        ? units === "imperial"
          ? Number(height) * 2.54
          : Number(height)
        : null;
      const days = availableDays.length >= 2 ? availableDays : [1, 2, 3, 4];
      return upsertMyProfile({
        data: {
          displayName: displayName.trim() || me.data?.displayName || "Athlete",
          bio,
          injuries,
          focusMuscles,
          goal: goal || undefined,
          experience: experience || undefined,
          equipment: equipment.length ? equipment : undefined,
          availableDays: days,
          daysPerWeek: days.length,
          sessionMinutes,
          units,
          weightKg,
          heightCm,
        },
      });
    },
    onSuccess: () => {
      toast("Profile updated — onboarding choices saved");
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const rebuild = useMutation({
    mutationFn: () => generateFirstPlan(),
    onSuccess: () => {
      toast("Plan rebuilt from your profile");
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = me.data;
  const displayUnits = p?.units ?? "metric";
  const { region } = useBillingRegion();
  const plan = quota.data?.plan ?? p?.plan ?? "free";
  const exhausted = Boolean(quota.data?.exhausted);
  const upgrades = (quota.data?.upgrades ?? []) as PaidMembership[];

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">@{p?.handle}</p>
          <h1 className="display text-3xl font-semibold">{p?.displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {p?.goal} · {p?.experience} · {p?.daysPerWeek} days
          </p>
        </div>
        <UserButton />
      </header>

      <section className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Membership</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl font-semibold">{membershipLabel(plan)}</h2>
          {quota.data?.limit == null ? (
            <p className="text-sm text-muted-foreground">Unlimited coach</p>
          ) : (
            <p className="text-sm tabular text-muted-foreground">
              {quota.data.used} / {quota.data.limit} coach asks this week
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{PLANS[plan].blurb}</p>
      </section>

      {exhausted && upgrades.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This week’s {membershipLabel(plan)} quota is used. Next tier:
          </p>
          {upgrades.map((tier) => {
            const spec = PLANS[tier];
            const price = formatPrice(region, "month", tier);
            const featured = tier === "pro";
            return (
              <Link
                key={tier}
                to="/pricing"
                className={cn(
                  "flex items-center justify-between rounded-xl px-5 py-4 shadow-[var(--shadow-border)]",
                  featured ? "bg-card shadow-[var(--shadow-border-hover)]" : "bg-card",
                )}
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {featured ? "Best value" : spec.name}
                  </p>
                  <p className="mt-1 text-sm">
                    {spec.name} · {price}/mo · {spec.blurb}
                  </p>
                </div>
                <span className="text-sm text-steel">See {spec.name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="space-y-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Profile — onboarding choices, editable</p>
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Athlete" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Train like a mission" />
          </div>
          <div className="space-y-2">
            <Label>Goal</Label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoal(g.id)} className={cn("h-10 rounded-full px-3 text-sm", goal === g.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{g.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Experience</Label>
            <div className="flex flex-wrap gap-2">
              {EXPS.map((e) => (
                <button key={e.id} type="button" onClick={() => setExperience(e.id)} className={cn("h-10 rounded-full px-3 text-sm", experience === e.id ? "bg-primary text-primary-foreground" : "bg-secondary")}>{e.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Build these most (up to 4)</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_MUSCLES.map((m) => {
                const on = focusMuscles.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => setFocusMuscles((prev) => on ? prev.filter((x) => x !== m.id) : prev.length >= 4 ? prev : [...prev, m.id])} className={cn("h-10 rounded-full px-3 text-sm", on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{m.label}</button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Equipment</Label>
            <div className="flex flex-wrap gap-2">
              {EQUIP.map((eq) => {
                const on = equipment.includes(eq);
                return <button key={eq} type="button" onClick={() => setEquipment((prev) => on ? prev.filter((x) => x !== eq) : [...prev, eq])} className={cn("h-10 rounded-full px-3 text-sm capitalize", on ? "bg-primary text-primary-foreground" : "bg-secondary")}>{eq}</button>;
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>When do you train?</Label>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => {
                const on = availableDays.includes(i);
                return <button key={`${d}-${i}`} type="button" onClick={() => setAvailableDays((prev) => on ? prev.filter((x) => x !== i) : [...prev, i].sort())} className={cn("size-9 rounded-full text-sm", on ? "bg-primary text-primary-foreground" : "bg-secondary")}>{d}</button>;
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Minutes / session</Label>
              <Input type="number" min={20} max={180} value={sessionMinutes} onChange={(e) => setSessionMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Units</Label>
              <div className="flex gap-2">
                {(["metric", "imperial"] as const).map((u) => (
                  <button key={u} type="button" onClick={() => setUnitsState(u)} className={cn("h-10 flex-1 rounded-md text-sm capitalize", units === u ? "bg-primary text-primary-foreground" : "bg-secondary")}>{u}</button>
                ))}
              </div>
            </div>
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
          <div className="space-y-2">
            <Label>Injuries</Label>
            <Textarea value={injuries} onChange={(e) => setInjuries(e.target.value)} placeholder="Left shoulder pinch…" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
            <Button variant="outline" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>{rebuild.isPending ? "Rebuilding…" : "Save & rebuild plan"}</Button>
          </div>
        </div>
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
            <p className="text-sm text-muted-foreground">PRs appear when a logged set beats your best e1RM.</p>
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
