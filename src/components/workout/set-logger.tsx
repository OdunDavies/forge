import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  restSecMap,
}: {
  session: WorkoutSession;
  units: "metric" | "imperial";
  onLog: (
    set: SessionSet,
    patch: { weightKg: number | null; reps: number | null; completed: boolean; rpe?: number | null },
  ) => void;
  onCompleteExercise: (name: string) => void;
  busyId?: number | null;
  busyName?: string | null;
  restSecMap?: Record<string, number>;
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

  const [draft, setDraft] = useState<Record<number, { w: string; r: string; rpe: string }>>({});
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [restLabel, setRestLabel] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (restUntil == null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [restUntil]);

  const remaining = restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const resting = restUntil != null && remaining > 0;

  useEffect(() => {
    if (restUntil != null && remaining <= 0) setRestUntil(null);
  }, [remaining, restUntil]);

  function startRest(exerciseName: string) {
    const sec = restSecMap?.[exerciseName] ?? 90;
    setRestUntil(Date.now() + sec * 1000);
    setRestLabel(exerciseName);
    setNow(Date.now());
    // keep screen awake during rest
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } };
      nav.wakeLock?.request("screen").then((s) => {
        wakeLockRef.current = s;
      }).catch(() => {});
    } catch {}
  }

  function skipRest() {
    setRestUntil(null);
    try { wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  }

  function val(set: SessionSet) {
    return (
      draft[set.id] ?? {
        w: set.weightKg != null ? String(displayWeight(set.weightKg, units)) : "",
        r: set.reps != null ? String(set.reps) : "",
        rpe: set.rpe != null ? String(set.rpe) : "",
      }
    );
  }

  function ghostText(group: Group): string | null {
    const last = [...group.sets].reverse().find((s) => s.completed && s.weightKg != null);
    if (!last) return null;
    const w = formatKg(last.weightKg, units);
    const r = last.reps != null ? ` x${last.reps}` : "";
    return `last: ${w}${r}`;
  }

  function stepWeight(current: string, dir: 1 | -1) {
    const cur = current === "" ? 0 : Number(current);
    if (Number.isNaN(cur)) return current;
    const step = units === "metric" ? 2.5 : 5;
    const next = Math.max(0, Math.round((cur + dir * step) * 10) / 10);
    return String(next);
  }

  function stepReps(current: string, dir: 1 | -1) {
    const cur = current === "" ? 0 : Number(current);
    if (Number.isNaN(cur)) return current;
    const next = Math.max(0, Math.round(cur + dir));
    return String(next);
  }

  return (
    <div className="space-y-4">
      {resting && (
        <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm">
          <span>Rest {remaining}s{restLabel ? ` · ${restLabel}` : ""}</span>
          <Button size="sm" variant="ghost" onClick={skipRest}>Skip</Button>
        </div>
      )}
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
            <div className="mt-3 space-y-3">
              {(() => {
                const ghost = ghostText(g);
                return g.sets.map((set) => {
                const d = val(set);
                const isEmpty = d.w === "" && d.r === "" && d.rpe === "";
                const ghostPlaceholder = isEmpty && ghost ? ghost : undefined;
                return (
                  <div key={set.id} className="space-y-2">
                    <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2">
                      <span className="text-xs tabular text-muted-foreground">{set.setIndex}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="decrease weight" className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-medium min-h-[44px] min-w-[28px]" onClick={() => setDraft((p) => ({ ...p, [set.id]: { ...d, w: stepWeight(d.w, -1) } }))}>−</button>
                        <Input
                          inputMode="decimal"
                          placeholder={ghostPlaceholder ?? (units === "metric" ? "kg" : "lb")}
                          value={d.w}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, [set.id]: { ...d, w: e.target.value } }))
                          }
                          className={cn("h-11 flex-1", isEmpty && ghostPlaceholder ? "placeholder:text-muted-foreground/40" : "")}
                        />
                        <button type="button" aria-label="increase weight" className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-medium min-h-[44px] min-w-[28px]" onClick={() => setDraft((p) => ({ ...p, [set.id]: { ...d, w: stepWeight(d.w, 1) } }))}>+</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="decrease reps" className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-medium min-h-[44px] min-w-[28px]" onClick={() => setDraft((p) => ({ ...p, [set.id]: { ...d, r: stepReps(d.r, -1) } }))}>−</button>
                        <Input
                          inputMode="numeric"
                          placeholder={isEmpty && ghostPlaceholder ? ghostPlaceholder : "reps"}
                          value={d.r}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, [set.id]: { ...d, r: e.target.value } }))
                          }
                          className="h-11 flex-1"
                        />
                        <button type="button" aria-label="increase reps" className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-medium min-h-[44px] min-w-[28px]" onClick={() => setDraft((p) => ({ ...p, [set.id]: { ...d, r: stepReps(d.r, 1) } }))}>+</button>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === set.id}
                        onClick={() => {
                          const w = d.w ? Number(d.w) : null;
                          const r = d.r ? Number(d.r) : null;
                          const weightKg = w == null ? null : units === "imperial" ? w / 2.20462 : w;
                          const rpeVal = d.rpe ? Number(d.rpe) : null;
                          const nextCompleted = !set.completed;
                          onLog(set, { weightKg, reps: r, completed: nextCompleted, rpe: rpeVal });
                          if (nextCompleted) {
                            startRest(g.name);
                            try { navigator.vibrate?.(20); } catch {}
                          }
                        }}
                        className={cn(
                          "grid size-11 place-items-center rounded-md transition-colors min-h-[44px] min-w-[44px]",
                          set.completed ? "bg-go text-background" : "bg-secondary text-muted-foreground",
                        )}
                        aria-label={set.completed ? "Completed" : "Complete set"}
                      >
                        <Check className="size-4" />
                      </button>
                    </div>
                    <div className="ml-8 flex flex-wrap gap-1.5">
                      {[6,7,8,9,10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            const next = String(n);
                            setDraft((p) => ({ ...p, [set.id]: { ...d, rpe: d.rpe === next ? "" : next } }));
                          }}
                          className={cn(
                            "h-7 min-h-[28px] min-w-[32px] rounded-full px-2 text-xs font-medium transition-colors",
                            d.rpe === String(n) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          RPE {n}
                        </button>
                      ))}
                      {d.rpe && <span className="self-center text-[10px] text-muted-foreground">tap to clear</span>}
                    </div>
                  </div>
                );
                });
              })()}
            </div>
            {g.sets.some((s) => s.isPr) && (
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-signal">Personal record locked</p>
            )}
            {g.sets.some((s) => s.completed) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const lastLogged = g.sets.filter((s) => s.completed).pop();
                  const defaultW = lastLogged?.weightKg ?? null;
                  const defaultR = lastLogged?.reps ?? null;
                  const newSet: SessionSet = {
                    id: Date.now(),
                    setIndex: g.sets.length + 1,
                    exerciseId: g.exerciseId,
                    exerciseName: g.name,
                    weightKg: defaultW,
                    reps: defaultR,
                    rpe: null,
                    completed: false,
                    isWarmup: false,
                    isPr: false,
                  };
                  onLog(newSet, { weightKg: defaultW, reps: defaultR, completed: false });
                }}
              >
                + set
              </Button>
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
