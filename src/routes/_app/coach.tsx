import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listCoachMessages, sendCoachMessage } from "@/lib/api/coach";
import { coachQuota } from "@/lib/api/billing";
import { confirmTweak, getActivePlan, tweakTodayPlan } from "@/lib/api/plan";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CenteredLoading } from "@/components/ui/centered-loading";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_app/coach")({ component: CoachPage });

const PROMPTS = [
  "Left shoulder felt sharp on pressing. Rewrite the next session.",
  "Energy is 2/5. Cut volume, keep the compounds.",
  "Hit a bench PR. Nudge next week’s upper day.",
];

function CoachPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const messages = useQuery({ queryKey: ["coach"], queryFn: () => listCoachMessages() });
  const quota = useQuery({ queryKey: ["coach-quota"], queryFn: () => coachQuota() });
  const planQ = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const [pendingTweak, setPendingTweak] = useState<null | {
    before: { name: string; sets: number; reps: string }[];
    after: { name: string; sets: number; reps: string }[];
    message: string;
    targetWeekday?: number;
  }>(null);

  const send = useMutation({
    mutationFn: () => sendCoachMessage({ data: { content: text.trim() } }),
    onSuccess: (res: unknown) => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["coach"] });
      void qc.invalidateQueries({ queryKey: ["coach-quota"] });
      if (res && typeof res === "object" && "retryable" in res && (res as { retryable?: boolean }).retryable) {
        toast("Coach is offline — you can retry.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tweakPreview = useMutation({
    mutationFn: () => tweakTodayPlan({ data: { reason: text || "Retune the next session from recent logs.", preview: true } }),
    onSuccess: (res) => {
      if ("retryable" in res && (res as { retryable?: boolean }).retryable) {
        console.warn("[coach] tweak preview failed retryable", res);
        toast.error((res as { message: string }).message);
        return;
      }
      if ("preview" in res && (res as { preview?: unknown }).preview) {
        const r = res as { preview: { name: string; sets: number; reps: string }[]; message: string; targetTitle?: string };
        const weekday = new Date().getDay();
        const days = planQ.data?.days ?? [];
        let target = days.find((d) => d.weekday === weekday && !d.isRest);
        if (!target) {
          for (let i = 1; i <= 7; i++) {
            const d = days.find((x) => x.weekday === (weekday + i) % 7 && !x.isRest);
            if (d) { target = d; break; }
          }
        }
        const before = (target?.exercises ?? []).map((e) => ({ name: e.exerciseName, sets: e.sets, reps: e.reps }));
        setPendingTweak({ before, after: r.preview, message: r.message, targetWeekday: target?.weekday });
      } else {
        toast((res as { message: string }).message);
        void qc.invalidateQueries({ queryKey: ["plan"] });
      }
    },
    onError: (e: Error) => {
      console.warn("[coach] tweak preview error", { error: e.message, retryable: true });
      toast.error(e.message);
    },
  });
  const confirm = useMutation({
    mutationFn: () => {
      if (!pendingTweak) throw new Error("No pending tweak");
      return confirmTweak({ data: { exercises: pendingTweak.after, message: pendingTweak.message, targetWeekday: pendingTweak.targetWeekday } });
    },
    onSuccess: (res) => {
      track("tweakTodayPlan", { source: "coach" });
      toast(res.message);
      setPendingTweak(null);
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const thread = [...(messages.data ?? [])].reverse();
  const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
  const isOfflineFallback = lastAssistant?.content.includes("Forge is offline");

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <header className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coach · Gemini</p>
        <h1 className="display text-3xl font-semibold">Coach</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Ask about load, swaps, or pain. Forge reads your log — it will not diagnose injuries.
        </p>
      </header>

      {/* Quota bar */}
      <div className="mb-3 rounded-md bg-secondary px-3 py-2 text-sm">
        {quota.isPending ? (
          <span className="text-muted-foreground">Loading quota…</span>
        ) : quota.data?.plan === "pro" ? (
          <span>Pro unlimited</span>
        ) : (
          <span>
            Free {quota.data?.used ?? 0}/{quota.data?.limit ?? 5} this week
            <span className="ml-2 text-muted-foreground">
              {quota.data?.remaining ?? 0} left
            </span>
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3">
        {thread.length === 0 && (
          <div className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">Tell Forge what happened. Or start from a cue:</p>
            <div className="flex flex-col gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setText(p)}
                  className="rounded-md bg-secondary px-3 py-3 text-left text-sm text-foreground hover:bg-elevated"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {thread.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[40rem] rounded-xl px-4 py-3 text-sm leading-relaxed",
              m.role === "user" ? "ml-auto bg-secondary" : "bg-card shadow-[var(--shadow-border)]",
            )}
          >
            {m.content}
          </div>
        ))}
        {isOfflineFallback && (
          <div className="flex justify-start">
            <Button variant="outline" size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
              Retry
            </Button>
          </div>
        )}
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Report the session. Be specific."
          className="min-h-24"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={send.isPending || !text.trim()} className="flex-1">
            Send
          </Button>
          <Button type="button" variant="outline" disabled={tweakPreview.isPending || send.isPending} onClick={() => tweakPreview.mutate()}>
            Apply to plan
          </Button>
        </div>
      </form>
      {send.isPending && <CenteredLoading steps={["Reading your log", "Writing your response"]} />}
      {tweakPreview.isPending && <CenteredLoading />}
      {confirm.isPending && <CenteredLoading />}

      {pendingTweak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Before vs After</h3>
            <p className="mt-2 text-sm text-muted-foreground">{pendingTweak.message}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Before</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {pendingTweak.before.length ? pendingTweak.before.map((e, i) => <li key={i}>{e.name} — {e.sets} × {e.reps}</li>) : <li>Rest / no exercises</li>}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">After</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {pendingTweak.after.map((e, i) => <li key={i}>{e.name} — {e.sets} × {e.reps}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>Apply</Button>
              <Button variant="outline" onClick={() => setPendingTweak(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
