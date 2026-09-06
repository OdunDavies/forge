import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionSet, WorkoutSession } from "@/lib/api/types";
import { cn, displayWeight, formatKg } from "@/lib/utils";

type Group = { name: string; exerciseId: string | null; sets: SessionSet[] };

export function SetLogger({
  session,
  units,
  onLog,
  onCompleteExercise,
  busyId,
  busyName,
}: {
  session: WorkoutSession;
  units: "metric" | "imperial";
  onLog: (set: SessionSet, patch: { weightKg: number | null; reps: number | null; completed: boolean }) => void;
  onCompleteExercise: (name: string) => void;
  busyId?: number | null;
  busyName?: string | null;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of session.sets) {
      const g = map.get(s.exerciseName) ?? { name: s.exerciseName, exerciseId: s.exerciseId, sets: [] };
      g.sets.push(s);
      map.set(s.exerciseName, g);
    }
    return [...map.values()];
  }, [session.sets]);

  const [draft, setDraft] = useState<Record<number, { w: string; r: string }>>({});

  function val(set: SessionSet) {
    return (
      draft[set.id] ?? {
        w: set.weightKg != null ? String(displayWeight(set.weightKg, units)) : "",
        r: set.reps != null ? String(set.reps) : "",
      }
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const allDone = g.sets.every((s) => s.completed);
        return (
          <section key={g.name} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="display text-lg font-semibold leading-tight">{g.name}</h3>
                <p className="mt-1 text-xs tabular text-muted-foreground">
                  {g.sets.length} sets
                  {g.sets[0]?.reps ? ` × ${g.sets[0].reps}` : ""}
                  {g.sets[0]?.weightKg != null ? ` · ${formatKg(g.sets[0].weightKg, units)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {g.exerciseId && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/library/$id" params={{ id: g.exerciseId }}>
                      How
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={allDone ? "secondary" : "default"}
                  disabled={busyName === g.name}
                  onClick={() => onCompleteExercise(g.name)}
                >
                  {allDone ? "Done" : busyName === g.name ? "Saving…" : "Mark done"}
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {g.sets.map((set) => {
                const d = val(set);
                return (
                  <div key={set.id} className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2">
                    <span className="text-xs tabular text-muted-foreground">{set.setIndex}</span>
                    <Input
                      inputMode="decimal"
                      placeholder={units === "metric" ? "kg" : "lb"}
                      value={d.w}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [set.id]: { ...d, w: e.target.value } }))
                      }
                      className="h-11"
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="reps"
                      value={d.r}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [set.id]: { ...d, r: e.target.value } }))
                      }
                      className="h-11"
                    />
                    <button
                      type="button"
                      disabled={busyId === set.id}
                      onClick={() => {
                        const w = d.w ? Number(d.w) : null;
                        const r = d.r ? Number(d.r) : null;
                        const weightKg = w == null ? null : units === "imperial" ? w / 2.20462 : w;
                        onLog(set, { weightKg, reps: r, completed: !set.completed });
                      }}
                      className={cn(
                        "grid size-11 place-items-center rounded-md transition-colors",
                        set.completed ? "bg-go text-background" : "bg-secondary text-muted-foreground",
                      )}
                      aria-label={set.completed ? "Completed" : "Complete set"}
                    >
                      <Check className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            {g.sets.some((s) => s.isPr) && (
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-signal">Personal record locked</p>
            )}
          </section>
        );
      })}
      {session.sets.length === 0 && (
        <p className="text-sm text-muted-foreground">Search the library below to add a movement.</p>
      )}
    </div>
  );
}

export function SessionHeader({
  session,
  units,
}: {
  session: WorkoutSession;
  units: "metric" | "imperial";
}) {
  const done = session.sets.filter((s) => s.completed).length;
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Today’s work</p>
        <h2 className="display text-2xl font-semibold">{session.title}</h2>
      </div>
      <p className="text-sm tabular text-muted-foreground">
        {done}/{session.sets.length} ·{" "}
        {formatKg(
          session.sets.reduce((a, s) => a + (s.completed ? (s.weightKg ?? 0) * (s.reps ?? 0) : 0), 0),
          units,
        )}
      </p>
    </div>
  );
}
