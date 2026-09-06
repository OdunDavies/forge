import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPersonalRecords, listMyHistory } from "@/lib/api/sessions";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { FOCUS_MUSCLES } from "@/lib/muscles";
import { cn, formatKg, formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => listMyHistory() });
  const prs = useQuery({ queryKey: ["prs"], queryFn: () => getPersonalRecords() });
  const [focusMuscles, setFocusMuscles] = useState<string[]>([]);

  useEffect(() => {
    if (me.data?.focusMuscles) setFocusMuscles(me.data.focusMuscles);
  }, [me.data?.focusMuscles]);

  const save = useMutation({
    mutationFn: (form: FormData) =>
      upsertMyProfile({
        data: {
          displayName: String(form.get("displayName") || me.data?.displayName || "Athlete"),
          bio: String(form.get("bio") || ""),
          injuries: String(form.get("injuries") || ""),
          focusMuscles,
        },
      }),
    onSuccess: () => {
      toast("Profile updated");
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const p = me.data;
  const units = p?.units ?? "metric";

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">@{p?.handle}</p>
          <h1 className="display text-3xl font-semibold">{p?.displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {p?.goal} · {p?.experience} · {p?.daysPerWeek} days
          </p>
        </div>
        <UserButton />
      </header>

      <form
        className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(new FormData(e.currentTarget));
        }}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <Input name="displayName" defaultValue={p?.displayName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea name="bio" defaultValue={p?.bio ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Build these most</Label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_MUSCLES.map((m) => {
              const on = focusMuscles.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setFocusMuscles((prev) =>
                      on ? prev.filter((x) => x !== m.id) : prev.length >= 4 ? prev : [...prev, m.id],
                    )
                  }
                  className={cn(
                    "h-10 rounded-full px-3 text-sm",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Injuries</Label>
          <Textarea name="injuries" defaultValue={p?.injuries ?? ""} />
        </div>
        <Button type="submit" disabled={save.isPending}>
          Save profile
        </Button>
      </form>

      <section>
        <h2 className="display text-xl font-semibold">Personal records</h2>
        <ul className="mt-3 space-y-2">
          {(prs.data ?? []).slice(0, 12).map((r) => (
            <li key={r.exerciseName} className="flex justify-between gap-3 text-sm">
              <span>{r.exerciseName}</span>
              <span className="tabular text-muted-foreground">
                {formatKg(r.weightKg, units)} × {r.reps}
              </span>
            </li>
          ))}
          {(prs.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">PRs appear when a logged set beats your best e1RM.</p>
          )}
        </ul>
      </section>

      <section>
        <h2 className="display text-xl font-semibold">Recent sessions</h2>
        <ul className="mt-3 space-y-2">
          {(history.data ?? []).map((s) => (
            <li key={s.id}>
              <Link
                to="/session/$id"
                params={{ id: String(s.id) }}
                className="flex items-center justify-between rounded-md bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]"
              >
                <span>{s.title}</span>
                <span className="tabular text-muted-foreground">
                  {formatKg(s.volumeKg, units)} · {formatDuration(s.durationSec)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Button variant="ghost" className="mt-3" asChild>
          <Link to="/history">Full history</Link>
        </Button>
      </section>
    </div>
  );
}
