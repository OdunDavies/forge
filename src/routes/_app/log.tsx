import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionHeader, SetLogger } from "@/components/workout/set-logger";
import { searchExercises } from "@/lib/api/library";
import { getActivePlan, retuneUpcoming } from "@/lib/api/plan";
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
  const results = useQuery({
    queryKey: ["ex-search", q],
    queryFn: () => searchExercises({ data: { q, limit: 8 } }),
    enabled: q.trim().length > 1,
  });

  const weekday = new Date().getDay();
  const today = plan.data?.days.find((d) => d.weekday === weekday);
  const shouldAutostart = Boolean(plan.data && today && !today.isRest);

  const start = useMutation({
    mutationFn: () => startTodaysSession(),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
  });
  const startEmpty = useMutation({
    mutationFn: () => startEmptySession({ data: "Open session" }),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
  });
  const finish = useMutation({
    mutationFn: () => finishSession({ data: { sessionId: sessionQ.data!.id, visibility: "public" } }),
    onSuccess: (s) => {
      toast("Workout logged — rewriting the next session…");
      void qc.invalidateQueries();
      void navigate({ to: "/session/$id", params: { id: String(s.id) } });
      void retuneUpcoming({ data: { trigger: "session" } })
        .then((r) => {
          if (r.applied) toast(r.message);
          void qc.invalidateQueries({ queryKey: ["plan"] });
        })
        .catch(() => {
          /* session is saved even if the coach is offline */
        });
    },
  });

  useEffect(() => {
    if (sessionQ.isPending || sessionQ.data || start.isPending || start.isSuccess) return;
    if (!plan.isSuccess || !shouldAutostart) return;
    start.mutate();
  }, [sessionQ.isPending, sessionQ.data, plan.isSuccess, shouldAutostart, start.isPending, start.isSuccess, start]);

  async function onLog(
    set: SessionSet,
    patch: { weightKg: number | null; reps: number | null; completed: boolean },
  ) {
    setBusyId(set.id);
    try {
      const res = await logSet({
        data: {
          setId: set.id,
          weightKg: patch.weightKg,
          reps: patch.reps,
          completed: patch.completed,
        },
      });
      if (res.isPr) toast("New PR");
      qc.setQueryData(["active-session"], res.session);
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
    <div>
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
          <SetLogger
            session={session}
            units={units}
            onLog={onLog}
            onCompleteExercise={onCompleteExercise}
            busyId={busyId}
            busyName={busyName}
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
                  await addExerciseToSession({
                    data: { sessionId: session.id, exerciseId: ex.id, exerciseName: ex.name, sets: 3 },
                  });
                  setQ("");
                  void qc.invalidateQueries({ queryKey: ["active-session"] });
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

          <div className="mt-8">
            <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="w-full">
              {finish.isPending ? "Saving recap…" : "Finish workout"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Remaining sets are marked done. Forge then rewrites the next session from this log.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
