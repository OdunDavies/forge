import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getMyProfile } from "@/lib/api/profile";
import { listMyHistory } from "@/lib/api/sessions";
import { formatDuration, formatKg, relativeTime } from "@/lib/utils";
import { FOCUS_MUSCLES } from "@/lib/muscles";

export const Route = createFileRoute("/_app/history")({ component: HistoryPage });

function HistoryPage() {
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => listMyHistory() });
  const units = profile.data?.units ?? "metric";
  const [muscle, setMuscle] = useState<string>("all");
  const [prOnly, setPrOnly] = useState(false);

  const filtered = useMemo(() => {
    const list = history.data ?? [];
    return list.filter((s) => {
      if (prOnly && s.prCount === 0) return false;
      if (muscle !== "all") {
        const needle = muscle.toLowerCase();
        const titleMatch = s.title.toLowerCase().includes(needle);
        const setsMatch = s.sets.some((x) => x.exerciseName.toLowerCase().includes(needle));
        if (!titleMatch && !setsMatch) return false;
      }
      return true;
    });
  }, [history.data, muscle, prOnly]);

  return (
    <div>
      <h1 className="display text-3xl font-semibold">History</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="all">All muscles</option>
          {FOCUS_MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={prOnly} onChange={(e) => setPrOnly(e.target.checked)} />
          PR only
        </label>
      </div>
      <ul className="mt-6 space-y-2">
        {filtered.map((s) => (
          <li key={s.id}>
            <Link
              to="/session/$id"
              params={{ id: String(s.id) }}
              className="block rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{s.title}</h2>
                <span className="text-xs text-muted-foreground">
                  {s.completedAt ? relativeTime(s.completedAt) : ""}
                </span>
              </div>
              <p className="mt-1 text-sm tabular text-muted-foreground">
                {formatKg(s.volumeKg, units)} · {s.setCount} sets · {formatDuration(s.durationSec)}
                {s.prCount ? ` · ${s.prCount} PR` : ""}
              </p>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No sessions match filters.</p>}
      </ul>
    </div>
  );
}
