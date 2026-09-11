import { Link } from "@tanstack/react-router";
import { Dumbbell, MessageCircle, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { durationParts } from "@/lib/share";
import { formatKg, initials, relativeTime } from "@/lib/utils";
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
  const time = durationParts(item.durationSec);
  const volume = formatKg(item.volumeKg, units);

  return (
    <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <header className="flex items-center gap-3 p-4 pb-3">
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

      <Link to="/session/$id" params={{ id: String(item.id) }} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#070708]">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(700px 500px at 60% 30%, rgb(22 22 24) 0%, #070708 72%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#070708]/70 to-black/30" />
          <p className="absolute right-4 top-4 display text-sm font-semibold uppercase tracking-[0.22em] text-white">
            FORGE
          </p>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4">
            <Dumbbell className="mb-2 size-7 text-white" strokeWidth={1.75} />
            <h3 className="display text-2xl font-semibold leading-tight text-white">{item.title}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-white">
              <div>
                <dt className="text-[12px] text-white/70">Volume</dt>
                <dd className="display text-xl font-semibold tabular">{volume}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/70">Time</dt>
                <dd className="display text-xl font-semibold tabular">
                  {time.primary}
                  {time.secondary ? <span className="ml-1 text-lg">{time.secondary}</span> : null}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Link>

      <footer className="flex items-center gap-2 p-4">
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
