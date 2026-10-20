import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateFirstPlan, getActivePlan } from "@/lib/api/plan";
import { track } from "@/lib/analytics";
import { cn, weekdayName } from "@/lib/utils";
import { CenteredLoading } from "@/components/ui/centered-loading";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/plan")({ component: PlanPage });

function PlanPage() {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const rebuild = useMutation({
    mutationFn: () => generateFirstPlan(),
    onSuccess: () => {
      track("generateFirstPlan", { source: "plan" });
      toast("Week rewritten from your profile");
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const weekday = new Date().getDay();
  if (plan.isPending) {
    return <div role="status" aria-busy="true" className="space-y-4"><div className="h-8 w-52 animate-pulse rounded bg-secondary" /><div className="h-40 animate-pulse rounded-2xl bg-card" /><div className="h-40 animate-pulse rounded-2xl bg-card" /></div>;
  }
  if (plan.isError) {
    return <div role="alert" className="rounded-2xl border bg-card p-6 text-center"><h1 className="display text-2xl font-semibold">Your plan couldn&apos;t load</h1><p className="mt-2 text-sm text-muted-foreground">Try again without leaving this page.</p><Button className="mt-5" onClick={() => void plan.refetch()}>Try again</Button></div>;
  }
  if (!plan.data) {
    return <div className="rounded-2xl border bg-card p-7 text-center"><CalendarDays className="mx-auto size-9 text-primary" aria-hidden="true"/><h1 className="display mt-4 text-2xl font-semibold">Build your first training week</h1><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Complete the quick setup so Forge can match sessions to your goal, schedule, and equipment.</p><Button className="mt-5" asChild><Link to="/onboarding">Start setup</Link></Button></div>;
  }
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{plan.data.split}</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="display text-3xl font-semibold">{plan.data.title}</h1>
        <Button variant="outline" size="sm" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
          Rebuild from profile
        </Button>
      </div>
      {plan.data.aiRationale && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{plan.data.aiRationale}</p>
      )}
      {rebuild.isPending && <CenteredLoading />}
      <div className="mt-6 space-y-3">
        {plan.data.days.map((d) => {
          const isToday = d.weekday === weekday;
          return (
            <section
              key={d.id}
              className={cn(
                "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
                isToday && "shadow-[var(--shadow-border-hover)]",
              )}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="display text-lg font-semibold">
                  {weekdayName(d.weekday)} · {d.title}
                </h2>
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {isToday ? "Today" : d.isRest ? "Rest" : ""}
                </span>
              </div>
              {d.coachNotes && <p className="mt-1 text-sm text-muted-foreground">{d.coachNotes}</p>}
              {!d.isRest && (
                <ul className="mt-3 space-y-2 text-sm">
                  {d.exercises.map((ex) => (
                    <li key={ex.id} className="flex justify-between gap-3">
                      {ex.exerciseId ? (
                        <Link to="/library/$id" params={{ id: ex.exerciseId }} className="truncate hover:underline">
                          {ex.exerciseName}
                        </Link>
                      ) : (
                        <span>{ex.exerciseName}</span>
                      )}
                      <span className="tabular text-muted-foreground">
                        {ex.sets} × {ex.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {isToday && !d.isRest && (
                <Link
                  to="/log"
                  className="mt-4 inline-flex h-11 items-center text-sm font-medium text-foreground"
                >
                  Start this session →
                </Link>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
