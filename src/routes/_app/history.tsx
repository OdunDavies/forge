import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile";
import { listMyHistory } from "@/lib/api/sessions";
import { formatDuration, formatKg, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/history")({ component: HistoryPage });

function HistoryPage() {
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => listMyHistory() });
  const units = profile.data?.units ?? "metric";
  return (
    <div>
      <h1 className="display text-3xl font-semibold">History</h1>
      <ul className="mt-6 space-y-2">
        {(history.data ?? []).map((s) => (
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
      </ul>
    </div>
  );
}
