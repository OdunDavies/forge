import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getTodaySummary, saveDailyLog } from "@/lib/api/daily";
import { getActivePlan, retuneUpcoming, tweakTodayPlan } from "@/lib/api/plan";
import { getMyProfile } from "@/lib/api/profile";
import { getActiveSession, startTodaysSession } from "@/lib/api/sessions";
import type { PlanDay } from "@/lib/api/types";
import { cn, formatKg, weekdayName } from "@/lib/utils";

export const Route = createFileRoute("/_app/today")({ component: TodayPage });

function nextTrainingDay(days: PlanDay[], weekday: number): PlanDay | undefined {
  for (let i = 1; i <= 7; i++) {
    const wd = (weekday + i) % 7;
    const day = days.find((d) => d.weekday === wd && !d.isRest);
    if (day) return day;
  }
  return days.find((d) => !d.isRest);
}

function TodayPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const summary = useQuery({ queryKey: ["today-summary"], queryFn: () => getTodaySummary() });
  const session = useQuery({ queryKey: ["active-session"], queryFn: () => getActiveSession() });
  const units = profile.data?.units ?? "metric";
  const weekday = new Date().getDay();
  const days = plan.data?.days ?? [];
  const today = days.find((d) => d.weekday === weekday);
  const next = today?.isRest ? nextTrainingDay(days, weekday) : undefined;
  const focus = today && !today.isRest ? today : next;

  const start = useMutation({
    mutationFn: () => startTodaysSession(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["active-session"] });
      void navigate({ to: "/log" });
    },
  });
  const tweak = useMutation({
    mutationFn: () => tweakTodayPlan({ data: {} }),
    onSuccess: (res) => {
      toast(res.message);
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const checkin = useMutation({
    mutationFn: (payload: { energy?: number; sleepHours?: number; bodyweightKg?: number }) =>
      saveDailyLog({ data: payload }),
    onSuccess: async (res) => {
      toast("Check-in saved");
      void qc.invalidateQueries({ queryKey: ["today-summary"] });
      if (!res.retune) return;
      try {
        const r = await retuneUpcoming({ data: { trigger: "checkin" } });
        if (r.applied) {
          toast(r.message);
          void qc.invalidateQueries({ queryKey: ["plan"] });
        }
      } catch {
        /* check-in is saved even if the rewrite misses */
      }
    },
  });

  const vol = summary.data?.volumeKg ?? 0;
  const week = summary.data?.weekVolumeKg ?? 0;
  const firstName = profile.data?.displayName?.split(" ")[0] ?? "Today";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {weekdayName(weekday)} · mission log
        </p>
        <h1 className="display mt-1 text-3xl font-semibold">{firstName}</h1>
      </header>

      {days.length > 0 && (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const isToday = d.weekday === weekday;
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg px-1 py-2 text-center",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.12em]">{weekdayName(d.weekday)}</p>
                <p className={cn("mt-1 text-[11px] font-medium", isToday && "text-primary-foreground")}>
                  {d.isRest ? "Rest" : d.title.split(" ")[0]}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Today volume</p>
          <p className="display mt-2 text-2xl tabular">{formatKg(vol, units)}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sets</p>
          <p className="display mt-2 text-2xl tabular">{summary.data?.setCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Week volume</p>
          <p className="display mt-2 text-2xl tabular">{formatKg(week, units)}</p>
          <Progress className="mt-3" value={Math.min(100, (week / 20000) * 100)} />
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {today?.isRest ? "Up next" : "Today’s work"}
            </p>
            <h2 className="display text-2xl font-semibold">
              {today?.isRest
                ? next
                  ? `${weekdayName(next.weekday)} · ${next.title}`
                  : "Rest day"
                : (today?.title ?? "Open session")}
            </h2>
            {(today?.isRest ? next?.coachNotes : today?.coachNotes) && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {today?.isRest ? next?.coachNotes : today?.coachNotes}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={tweak.isPending || !focus || focus.isRest}
            onClick={() => tweak.mutate()}
          >
            <Sparkles className="size-4" />
            {tweak.isPending ? "Retuning…" : "Coach tweak"}
          </Button>
        </div>

        {today?.isRest && !next ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Rest day. Walk, eat, sleep. Logging is optional.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-border">
            {(focus?.exercises ?? []).map((ex) => (
              <li key={ex.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
                {ex.exerciseId ? (
                  <Link to="/library/$id" params={{ id: ex.exerciseId }} className="truncate hover:underline">
                    {ex.exerciseName}
                  </Link>
                ) : (
                  <span>{ex.exerciseName}</span>
                )}
                <span className="tabular text-muted-foreground">
                  {ex.sets} × {ex.reps}
                  {ex.targetRpe ? ` @ ${ex.targetRpe}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        {today?.isRest && (
          <p className="mt-4 text-sm text-muted-foreground">
            Recovery day. Sleep, walk, eat. You can still log an open session.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {session.data
              ? "Continue session"
              : today?.isRest
                ? "Log an open session"
                : "Start session"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/library">Movement library</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/plan">Full week</Link>
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="display text-lg font-semibold">Daily check-in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Energy 1–2 or short sleep automatically cuts today’s volume. Finishing a workout rewrites the next one.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const energy = fd.get("energy") ? Number(fd.get("energy")) : undefined;
            const sleep = fd.get("sleep") ? Number(fd.get("sleep")) : undefined;
            const bw = fd.get("bw") ? Number(fd.get("bw")) : undefined;
            checkin.mutate({
              energy,
              sleepHours: sleep,
              bodyweightKg: bw && units === "imperial" ? bw / 2.20462 : bw,
            });
          }}
        >
          <div className="space-y-2">
            <Label>Energy 1–5</Label>
            <Input
              name="energy"
              type="number"
              min={1}
              max={5}
              defaultValue={summary.data?.log?.energy ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Sleep hours</Label>
            <Input
              name="sleep"
              type="number"
              step="0.5"
              defaultValue={summary.data?.log?.sleepHours ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Bodyweight ({units === "metric" ? "kg" : "lb"})</Label>
            <Input
              name="bw"
              type="number"
              step="0.1"
              defaultValue={summary.data?.log?.bodyweightKg ?? ""}
            />
          </div>
          <Button type="submit" className="sm:col-span-3" disabled={checkin.isPending}>
            Save check-in
          </Button>
        </form>
      </Card>
    </div>
  );
}
