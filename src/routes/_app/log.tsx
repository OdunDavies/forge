import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionHeader, SetLogger } from "@/components/workout/set-logger";
import { searchExercises } from "@/lib/api/library";
import { getActivePlan } from "@/lib/api/plan";
import { getMyProfile } from "@/lib/api/profile";
import {
  addExerciseToSession,
  addSetToSession,
  completeExercise,
  finishSession,
  getActiveSession,
  listMyLifts,
  logSet,
  removeSetFromSession,
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
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("private");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const results = useQuery({
    queryKey: ["ex-search", q],
    queryFn: () => searchExercises({ data: { q, limit: 8 } }),
    enabled: q.trim().length > 1,
  });
  const mine = useQuery({ queryKey: ["my-lifts"], queryFn: () => listMyLifts() });

  const weekday = new Date().getDay();
  const today = plan.data?.days.find((d) => d.weekday === weekday);
  const shouldAutostart = Boolean(plan.data && today && !today.isRest);

  const start = useMutation({
    mutationFn: () => startTodaysSession(),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
    onError: (e: Error) => toast.error(e.message),
  });
  const startEmpty = useMutation({
    mutationFn: () => startEmptySession({ data: "Open session" }),
    onSuccess: (s) => qc.setQueryData(["active-session"], s),
    onError: (e: Error) => toast.error(e.message),
  });
  const finish = useMutation({
    mutationFn: () => finishSession({ data: { sessionId: sessionQ.data!.id, visibility } }),
    onSuccess: (s) => {
      toast("Workout logged");
      void qc.invalidateQueries();
      void navigate({ to: "/session/$id", params: { id: String(s.id) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (
      sessionQ.isPending ||
      sessionQ.isError ||
      sessionQ.data ||
      start.isPending ||
      start.isSuccess ||
      start.isError
    )
      return;
    if (!plan.isSuccess || !shouldAutostart) return;
    start.mutate();
  }, [
    sessionQ.isPending,
    sessionQ.isError,
    sessionQ.data,
    plan.isSuccess,
    shouldAutostart,
    start.isPending,
    start.isSuccess,
    start,
  ]);

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
      // Resolve exercise name via matcher for correct catalog id
      const exerciseName = name;
      const res = await completeExercise({ data: { sessionId: sessionQ.data.id, exerciseName } });
      if (res.isPr) toast("New PR");
      qc.setQueryData(["active-session"], res.session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish the lift");
    } finally {
      setBusyName(null);
    }
  }

  async function onAddSet(name: string) {
    if (!sessionQ.data) return;
    setBusyName(name);
    try {
      // Resolve exercise name via matcher for correct catalog id
      const exerciseName = name;
      const session = await addSetToSession({
        data: { sessionId: sessionQ.data.id, exerciseName },
      });
      qc.setQueryData(["active-session"], session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add set");
    } finally {
      setBusyName(null);
    }
  }

  async function onRemoveSet(set: SessionSet) {
    if (!sessionQ.data) return;
    setBusyId(set.id);
    try {
      const session = await removeSetFromSession({
        data: { sessionId: sessionQ.data.id, setId: set.id },
      });
      qc.setQueryData(["active-session"], session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove set");
    } finally {
      setBusyId(null);
    }
  }

  async function addLift(name: string, exerciseId: string | null) {
    if (!sessionQ.data) return;
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2) {
      toast.error("Name the lift");
      return;
    }
    setAddingCustom(true);
    try {
      const cid = exerciseId;
      const next = await addExerciseToSession({
        data: { sessionId: sessionQ.data.id, exerciseId: cid, exerciseName: trimmed, sets: 1 },
      });
      qc.setQueryData(["active-session"], next);
      setQ("");
      if (!exerciseId) void qc.invalidateQueries({ queryKey: ["my-lifts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that lift");
    } finally {
      setAddingCustom(false);
    }
  }

  const session = sessionQ.data;
  const inSession = new Set((session?.sets ?? []).map((s) => s.exerciseName.toLowerCase()));
  const needle = q.trim().toLowerCase();
  const customHits = (mine.data ?? [])
    .filter((name) => !inSession.has(name.toLowerCase()))
    .filter((name) => !needle || name.toLowerCase().includes(needle))
    .slice(0, 8);
  const exactLibrary = results.data?.items.find((ex) => ex.name.toLowerCase() === needle);
  const exactCustom = customHits.some((name) => name.toLowerCase() === needle);

  return (
    <div>
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Logger</p>
        <h1 className="display text-3xl font-semibold">Mark it done</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Today's lifts are already loaded. Adjust a number if you want — or tap Mark done.
        </p>
      </header>

      {sessionQ.isError && (
        <p role="alert">
          Could not load your session.{" "}
          <button type="button" className="underline" onClick={() => void sessionQ.refetch()}>
            Retry
          </button>
        </p>
      )}
      {!session ? (
        <div className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted-foreground">
            {(shouldAutostart && !start.isError) || start.isPending
              ? "Loading today's work…"
              : "No session running. Start from today's plan or go freestyle."}
          </p>
          {(!shouldAutostart || start.isError) && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => start.mutate()}>Start today's workout</Button>
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
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            busyId={busyId}
            busyName={busyName}
          />

          <div className="mt-6 space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = q.trim();
                // Use matcher to find the best match
                void addLift(name, exactLibrary?.id ?? null);
              }}
            >
              <Input
                aria-label="Add an exercise"
                placeholder="Search the library or type your own lift…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={addingCustom || q.trim().length < 2}
              >
                {addingCustom ? "Adding…" : "Add"}
              </Button>
            </form>
            {q.trim().length > 1 && !exactLibrary && !exactCustom && (
              <button
                type="button"
                disabled={addingCustom}
                className="flex h-12 w-full items-center justify-between rounded-md border border-dashed border-border bg-card px-3 text-left text-sm"
                onClick={() => void addLift(q, null)}
              >
                <span>
                  Use <span className="font-medium text-foreground">&ldquo;{q.trim()}&rdquo;</span>{" "}
                  as your lift
                </span>
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Custom
                </span>
              </button>
            )}
            {customHits.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Your lifts
                </p>
                {customHits.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="flex h-12 w-full items-center justify-between rounded-md bg-card px-3 text-left text-sm shadow-[var(--shadow-border)]"
                    onClick={() => void addLift(name, null)}
                  >
                    <span>{name}</span>
                    <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Yours
                    </span>
                  </button>
                ))}
              </div>
            )}
            {results.data?.items.map((ex) => {
              // Use matcher-resolved id for exact library entries
              return (
                <button
                  key={ex.id}
                  type="button"
                  className="flex h-12 w-full items-center justify-between rounded-md bg-secondary px-3 text-left text-sm"
                  onClick={() => void addLift(ex.name, ex.id)}
                >
                  <span>{ex.name}</span>
                  <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {ex.equipment}
                  </span>
                </button>
              );
            })}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/library">Browse movement library</Link>
            </Button>
          </div>

          <div className="mt-8 space-y-3">
            <label htmlFor="workout-visibility" className="block text-sm font-medium">
              Who can see this workout?
            </label>
            <select
              id="workout-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as typeof visibility)}
              className="h-11 w-full rounded-md bg-secondary px-3 text-sm"
              disabled={finish.isPending}
            >
              <option value="private">Only me</option>
              <option value="followers">My followers</option>
              <option value="public">Everyone</option>
            </select>
            <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="w-full">
              {finish.isPending ? "Saving recap…" : "Finish workout"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Only completed sets count toward your progress.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
