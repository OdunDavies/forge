import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateFirstPlan, getActivePlan } from "@/lib/api/plan";
import { cn, weekdayName } from "@/lib/utils";
import { CenteredLoading } from "@/components/ui/centered-loading";

export const Route = createFileRoute("/_app/plan")({ component: PlanPage });

function PlanPage() {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const rebuild = useMutation({
    mutationFn: () => generateFirstPlan(),
    onSuccess: () => {
      toast("Week rewritten from your profile");
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const weekday = new Date().getDay();
  if (!plan.data) {
    return <p className="text-sm text-muted-foreground">No active plan. Finish onboarding to generate one.</p>;
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
