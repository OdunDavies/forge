import { Link } from "@tanstack/react-router";
import { MessageCircle, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatKg, initials, relativeTime } from "@/lib/utils";
import type { FeedItem } from "@/lib/api/social";
import { cn } from "@/lib/utils";

export function ActivityCard({
  item,
  units = "metric",
  onKudos,
}: {
  item: FeedItem;
  units?: "metric" | "imperial";
  onKudos?: () => void;
}) {
  return (
    <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <header className="flex items-center gap-3">
        <Link
          to="/u/$handle"
          params={{ handle: item.handle }}
          className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-semibold"
        >
          {initials(item.displayName)}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/u/$handle" params={{ handle: item.handle }} className="truncate text-sm font-medium">
            {item.displayName}
          </Link>
          <p className="text-xs text-muted-foreground">
            @{item.handle} · {relativeTime(item.completedAt)}
          </p>
        </div>
        {item.prCount > 0 && (
          <Badge variant="signal">
            <Trophy className="mr-1 size-3" />
            {item.prCount} PR
          </Badge>
        )}
      </header>

      <Link to="/session/$id" params={{ id: String(item.id) }} className="mt-4 block">
        {item.photoUrl && (
          <img src={item.photoUrl} alt="" className="mb-3 aspect-[16/10] w-full rounded-lg object-cover" />
        )}
        <h3 className="display text-xl font-semibold">{item.title}</h3>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Volume</dt>
            <dd className="tabular">{formatKg(item.volumeKg, units)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sets</dt>
            <dd className="tabular">{item.setCount}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Time</dt>
            <dd className="tabular">{formatDuration(item.durationSec)}</dd>
          </div>
        </dl>
        {item.topSets.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {item.topSets.map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">{s.exerciseName}</span>
                <span className="tabular text-foreground">
                  {s.weightKg ? formatKg(s.weightKg, units) : "BW"} × {s.reps ?? "—"}
                  {s.isPr ? " PR" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Link>

      <footer className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onKudos}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium uppercase tracking-[0.12em]",
            item.iKudoed ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          <Zap className="size-3.5" />
          Kudos {item.kudos}
        </button>
        <Link
          to="/session/$id"
          params={{ id: String(item.id) }}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          <MessageCircle className="size-3.5" />
          {item.comments}
        </Link>
      </footer>
    </article>
  );
}
