import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listCoachMessages, sendCoachMessage } from "@/lib/api/coach";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const planQ = useQuery({ queryKey: ["plan"], queryFn: () => getActivePlan() });
  const [pendingTweak, setPendingTweak] = useState<null | {
    before: { name: string; sets: number; reps: string }[];
    after: { name: string; sets: number; reps: string }[];
    message: string;
    targetWeekday?: number;
  }>(null);

  const send = useMutation({
    mutationFn: (content: string) => sendCoachMessage({ data: { content } }),
    onSuccess: (res, content) => {
      if (res.retryable) {
        toast.error(res.reply);
        return;
      }
      setText((current) => (current.trim() === content ? "" : current));
      void qc.invalidateQueries({ queryKey: ["coach"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tweakPreview = useMutation({
    mutationFn: () =>
      tweakTodayPlan({
        data: { reason: text || "Retune the next session from recent logs.", preview: true },
      }),
    onSuccess: (res) => {
      if ("retryable" in res && (res as { retryable?: boolean }).retryable) {
        console.warn("[coach] tweak preview failed retryable", res);
        toast.error((res as { message: string }).message);
        return;
      }
      if ("preview" in res && (res as { preview?: unknown }).preview) {
        const r = res as {
          preview: { name: string; sets: number; reps: string }[];
          message: string;
          targetWeekday: number;
        };
        const target = planQ.data?.days.find((d) => d.weekday === r.targetWeekday);
        const before = (target?.exercises ?? []).map((e) => ({
          name: e.exerciseName,
          sets: e.sets,
          reps: e.reps,
        }));
        setPendingTweak({
          before,
          after: r.preview,
          message: r.message,
          targetWeekday: r.targetWeekday,
        });
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
      return confirmTweak({
        data: {
          exercises: pendingTweak.after,
          message: pendingTweak.message,
          targetWeekday: pendingTweak.targetWeekday,
        },
      });
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

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <header className="mb-4">
        <h1 className="display text-3xl font-semibold">Coach</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Ask about load, swaps, or pain. Forge reads your log — it will not diagnose injuries.
        </p>
      </header>

      <div className="flex-1 space-y-3">
        {thread.length === 0 && (
          <div className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">
              Tell Forge what happened. Or start from a cue:
            </p>
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
      </div>

      {messages.isError && (
        <p role="alert">
          Could not load your messages.{" "}
          <button type="button" className="underline" onClick={() => void messages.refetch()}>
            Retry
          </button>
        </p>
      )}
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate(text.trim());
        }}
      >
        <label htmlFor="coach-message" className="sr-only">
          Message to coach
        </label>
        <Textarea
          id="coach-message"
          maxLength={800}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Report the session. Be specific."
          className="min-h-24"
        />
        {(send.isError || send.data?.retryable) && (
          <p role="alert" className="text-sm text-destructive">
            Coach is unavailable right now. Your message is still here. Try sending it again.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={send.isPending || !text.trim()} className="flex-1">
            Send
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={tweakPreview.isPending || send.isPending || !planQ.data}
            onClick={() => tweakPreview.mutate()}
          >
            Preview plan changes
          </Button>
        </div>
      </form>
      {send.isPending && <CenteredLoading steps={["Reading your log", "Writing your response"]} />}
      {tweakPreview.isPending && <CenteredLoading />}
      {confirm.isPending && <CenteredLoading />}

      {pendingTweak && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !confirm.isPending) setPendingTweak(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="max-h-[80vh] max-w-2xl overflow-auto"
          >
            <DialogTitle>Review plan changes</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">{pendingTweak.message}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Before</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {pendingTweak.before.length ? (
                    pendingTweak.before.map((e, i) => (
                      <li key={i}>
                        {e.name} — {e.sets} × {e.reps}
                      </li>
                    ))
                  ) : (
                    <li>Rest / no exercises</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">After</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {pendingTweak.after.map((e, i) => (
                    <li key={i}>
                      {e.name} — {e.sets} × {e.reps}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                Apply
              </Button>
              <Button variant="outline" onClick={() => setPendingTweak(null)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
