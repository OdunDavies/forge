import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listCoachMessages, sendCoachMessage } from "@/lib/api/coach";
import { coachQuota } from "@/lib/api/billing";
import { tweakTodayPlan } from "@/lib/api/plan";
import { formatPrice, membershipLabel, PLANS, useBillingRegion } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CenteredLoading } from "@/components/ui/centered-loading";

export const Route = createFileRoute("/_app/coach")({ component: CoachPage });

const PROMPTS = [
  "Left shoulder felt sharp on pressing. Rewrite the next session.",
  "Energy is 2/5. Cut volume, keep the compounds.",
  "Hit a bench PR. Nudge next week’s upper day.",
];

function CoachPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { region } = useBillingRegion();
  const messages = useQuery({ queryKey: ["coach"], queryFn: () => listCoachMessages() });
  const quota = useQuery({ queryKey: ["coach-quota"], queryFn: () => coachQuota() });
  const send = useMutation({
    mutationFn: () => sendCoachMessage({ data: { content: text.trim() } }),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["coach"] });
      void qc.invalidateQueries({ queryKey: ["coach-quota"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tweak = useMutation({
    mutationFn: () => tweakTodayPlan({ data: { reason: text || "Retune the next session from recent logs." } }),
    onSuccess: (res) => {
      toast(res.message);
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });

  const thread = [...(messages.data ?? [])].reverse();
  const exhausted = Boolean(quota.data?.exhausted);
  const plan = quota.data?.plan ?? "free";

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <header className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coach · Gemini</p>
        <h1 className="display text-3xl font-semibold">Coach</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Ask about load, swaps, or pain. Finishing a workout already rewrites the next session — this chat is extra.
          Forge will not diagnose injuries.
        </p>
        {quota.data?.limit == null ? (
          <p className="mt-2 text-sm text-muted-foreground">{membershipLabel(plan)} · unlimited</p>
        ) : (
          <p className="mt-2 text-sm tabular text-muted-foreground">
            {membershipLabel(plan)} · {quota.data.used} / {quota.data.limit} asks this week
          </p>
        )}
      </header>

      {exhausted && (quota.data?.upgrades.length ?? 0) > 0 && (
        <div className="mb-4 space-y-2">
          {quota.data!.upgrades.map((tier) => (
            <Link
              key={tier}
              to="/pricing"
              className="flex items-center justify-between rounded-xl bg-card px-5 py-4 text-sm shadow-[var(--shadow-border)]"
            >
              <span>
                {tier === "pro" ? "Best value · " : ""}
                {PLANS[tier].name} · {formatPrice(region, "month", tier)}/mo
              </span>
              <span className="text-steel">See {PLANS[tier].name}</span>
            </Link>
          ))}
        </div>
      )}

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
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !exhausted) send.mutate();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Report the session. Be specific."
          className="min-h-24"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={send.isPending || !text.trim() || exhausted} className="flex-1">
            {exhausted ? "Week’s asks used" : send.isPending ? "Reading your log" : "Send"}
          </Button>
          <Button type="button" variant="outline" disabled={tweak.isPending || send.isPending} onClick={() => tweak.mutate()}>
            Apply to plan
          </Button>
        </div>
      </form>
      {send.isPending && <CenteredLoading steps={["Reading your log", "Writing your response"]} />}
      {tweak.isPending && <CenteredLoading />}
    </div>
  );
}
