import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionHeader, SetLogger } from "@/components/workout/set-logger";
import { searchExercises } from "@/lib/api/library";
import { getActivePlan } from "@/lib/api/plan";
import { getMyProfile } from "@/lib/api/profile";
import {
  addExerciseToSession,
  completeExercise,
  finishSession,
  getActiveSession,
  logSet,
  startEmptySession,
  startTodaysSession,
} from "@/lib/api/sessions";
import { track } from "@/lib/analytics";
import type { SessionSet } from "@/lib/api/types";

export const Route = createFileRoute("/_app/log")({ component: LogPage });

function LogPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const sessionQ = useQuery({ queryKey: ["active-session"], queryFn: () => getActiveSession() });
  const units = profile.data?.units ?? "metric";
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);
  // duration pause tracking
  const [isPaused, setIsPaused] = useState(false);
  const [pausedMs, setPausedMs] = useState(0);
  const pauseStartRef = useRef<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const results = useQuery({
    queryKey: ["ex-search", q],
    queryFn: () => searchExercises({ data: { q, limit: 8 } }),
    enabled: q.trim().length > 1,
  });

  const weekday = new Date().getDay();
  const today = plan.data?.days.find((d) => d.weekday === weekday);
  const shouldAutostart = Boolean(plan.data && today && !today.isRest);

  const restSecMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of plan.data?.days ?? []) {
      for (const ex of d.exercises) m[ex.exerciseName] = ex.restSec;
    }
    return m;
  }, [plan.data]);

  // offline queue helpers
  function getQueue(): Array<Record<string, unknown>> {
    try {
      const raw = localStorage.getItem("forge-queue");
      return raw ? JSON.parse(raw) as Array<Record<string, unknown>> : [];
    } catch { return []; }
  }
  function saveQueue(q: Array<Record<string, unknown>>) {
    try { localStorage.setItem("forge-queue", JSON.stringify(q)); } catch {}
    setQueueCount(q.length);
  }
  function enqueue(item: Record<string, unknown>) {
    const q = getQueue();
    q.push(item);
    saveQueue(q);
  }

  useEffect(() => {
    setQueueCount(getQueue().length);
    function onOnline() {
      setIsOnline(true);
      const q = getQueue();
      if (q.length === 0) return;
      (async () => {
        for (const item of [...q]) {
          try {
            if (item.type === "logSet") {
              const d = item.data as { setId: number; weightKg: number | null; reps: number | null; completed: boolean; rpe?: number | null };
              await logSet({ data: d });
            } else if (item.type === "addExercise") {
              const d = item.data as { sessionId: number; exerciseId: string; exerciseName: string; sets: number };
              await addExerciseToSession({ data: d });
            }
          } catch {}
        }
        saveQueue([]);
        void qc.invalidateQueries({ queryKey: ["active-session"] });
        toast("Queued actions synced");
      })();
    }
    function onOffline() { setIsOnline(false); }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [qc]);

  // tick for duration display
  useEffect(() => {
    if (!sessionQ.data || isPaused) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionQ.data, isPaused]);

  const durationSec = useMemo(() => {
    if (!sessionQ.data) return 0;
    const started = new Date(sessionQ.data.startedAt).getTime();
    const extraPaused = isPaused && pauseStartRef.current ? Date.now() - pauseStartRef.current : 0;
    return Math.max(0, Math.floor((tick - started - pausedMs - extraPaused) / 1000));
  }, [sessionQ.data, tick, pausedMs, isPaused]);

  function togglePause() {
    if (isPaused) {
      if (pauseStartRef.current) setPausedMs((p) => p + (Date.now() - pauseStartRef.current!));
      pauseStartRef.current = null;
      setIsPaused(false);
    } else {
      pauseStartRef.current = Date.now();
      setIsPaused(true);
    }
  }

  const start = useMutation({
    mutationFn: () => startTodaysSession(),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
  });
  const startEmpty = useMutation({
    mutationFn: () => startEmptySession({ data: "Open session" }),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
  });
  const finish = useMutation({
    mutationFn: async () => {
      if (!sessionQ.data) throw new Error("No session");
      const s = sessionQ.data;
      const allDone = s.sets.length > 0 && s.sets.every((x) => x.completed);
      let vis = visibility;
      if (vis === "public" && !allDone) {
        const ok = window.confirm("Not all sets are completed. Publish as public anyway? Cancel will save as private.");
        if (!ok) vis = "private";
      }
      // compute final duration including pause
      const started = new Date(s.startedAt).getTime();
      const extraPaused = isPaused && pauseStartRef.current ? Date.now() - pauseStartRef.current : 0;
      const dur = Math.max(60, Math.floor((Date.now() - started - pausedMs - extraPaused) / 1000));
      return finishSession({ data: { sessionId: s.id, visibility: vis, durationSec: dur } });
    },
    onSuccess: (s) => {
      track("finishSession", { volume: s.volumeKg, durationSec: s.durationSec });
      toast("Workout logged");
      void qc.invalidateQueries();
      void navigate({ to: "/session/$id", params: { id: String(s.id) } });
    },
  });

  useEffect(() => {
    if (sessionQ.isPending || sessionQ.data || start.isPending || start.isSuccess) return;
    if (!plan.isSuccess || !shouldAutostart) return;
    start.mutate();
  }, [sessionQ.isPending, sessionQ.data, plan.isSuccess, shouldAutostart, start.isPending, start.isSuccess, start]);

  async function onLog(
    set: SessionSet,
    patch: { weightKg: number | null; reps: number | null; completed: boolean; rpe?: number | null },
  ) {
    if (!navigator.onLine) {
      enqueue({ type: "logSet", data: { setId: set.id, weightKg: patch.weightKg, reps: patch.reps, completed: patch.completed, rpe: patch.rpe ?? null } });
      toast("Offline - queued");
      return;
    }
    setBusyId(set.id);
    try {
      const res = await logSet({
        data: {
          setId: set.id,
          weightKg: patch.weightKg,
          reps: patch.reps,
          completed: patch.completed,
          rpe: patch.rpe ?? null,
        },
      });
      if (res.isPr) toast("New PR");
      qc.setQueryData(["active-session"], res.session);
    } catch {
      enqueue({ type: "logSet", data: { setId: set.id, weightKg: patch.weightKg, reps: patch.reps, completed: patch.completed, rpe: patch.rpe ?? null } });
      toast("Offline - queued");
    } finally {
      setBusyId(null);
    }
  }

  async function onCompleteExercise(name: string) {
    if (!sessionQ.data) return;
    setBusyName(name);
    try {
      const res = await completeExercise({ data: { sessionId: sessionQ.data.id, exerciseName: name } });
      if (res.isPr) toast("New PR");
      qc.setQueryData(["active-session"], res.session);
    } finally {
      setBusyName(null);
    }
  }

  const session = sessionQ.data;

  return (
    <div className="pb-20 md:pb-0">
      {!isOnline && (
        <div className="mb-4 rounded-md bg-warn px-4 py-2 text-center text-sm text-background">Offline - queued{queueCount ? ` (${queueCount})` : ""}</div>
      )}
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Logger</p>
        <h1 className="display text-3xl font-semibold">Mark it done</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Today’s lifts are already loaded. Adjust a number if you want — or tap Mark done.
        </p>
      </header>

      {!session ? (
        <div className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted-foreground">
            {shouldAutostart || start.isPending
              ? "Loading today’s work…"
              : "No session running. Start from today’s plan or go freestyle."}
          </p>
          {!shouldAutostart && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => start.mutate()}>Start today’s workout</Button>
              <Button variant="outline" onClick={() => startEmpty.mutate()}>
                Empty session
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <SessionHeader session={session} units={units} />
          <div className="mb-3 flex items-center gap-2 text-sm tabular">
            <span>{Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, "0")}</span>
            <Button size="sm" variant="outline" onClick={togglePause}>{isPaused ? "Resume" : "Pause"}</Button>
            {isPaused && <span className="text-xs text-muted-foreground">Paused</span>}
          </div>
          <SetLogger
            session={session}
            units={units}
            onLog={onLog}
            onCompleteExercise={onCompleteExercise}
            busyId={busyId}
            busyName={busyName}
            restSecMap={restSecMap}
          />

          <div className="mt-6 space-y-3">
            <Input
              placeholder="Add a movement from the library…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {results.data?.items.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="flex h-12 w-full items-center justify-between rounded-md bg-secondary px-3 text-left text-sm"
                onClick={async () => {
                  if (!navigator.onLine) {
                    enqueue({ type: "addExercise", data: { sessionId: session.id, exerciseId: ex.id, exerciseName: ex.name, sets: 3 } });
                    toast("Offline - queued");
                    setQ("");
                    return;
                  }
                  try {
                    await addExerciseToSession({
                      data: { sessionId: session.id, exerciseId: ex.id, exerciseName: ex.name, sets: 3 },
                    });
                    setQ("");
                    void qc.invalidateQueries({ queryKey: ["active-session"] });
                  } catch {
                    enqueue({ type: "addExercise", data: { sessionId: session.id, exerciseId: ex.id, exerciseName: ex.name, sets: 3 } });
                    toast("Offline - queued");
                  }
                }}
              >
                <span>{ex.name}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{ex.equipment}</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/library">Browse movement library</Link>
            </Button>
          </div>

          <div className="mt-8 space-y-2">
            <div className="flex gap-2">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="rounded-md border px-2 py-2 text-sm">
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Private</option>
              </select>
              <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="flex-1">
                {finish.isPending ? "Saving recap…" : "Finish workout"}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Remaining sets are marked done with the numbers already filled in.
            </p>
          </div>
          {/* sticky footer for mobile */}
          <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background px-4 py-3 md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Button variant="outline" className="flex-1" onClick={togglePause}>{isPaused ? "Resume" : "Pause"}</Button>
            <Button className="flex-[2]" onClick={() => finish.mutate()} disabled={finish.isPending}>{finish.isPending ? "Saving…" : "Finish"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
