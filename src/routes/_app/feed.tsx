import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityCard } from "@/components/social/activity-card";
import { getMyProfile } from "@/lib/api/profile";
import { getFeed, toggleKudos } from "@/lib/api/social";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/feed")({ component: FeedPage });

function FeedPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"following" | "global">("global");
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const feed = useQuery({
    queryKey: ["feed", scope],
    queryFn: () => getFeed({ data: scope }),
  });
  const kudos = useMutation({
    mutationFn: (id: number) => toggleKudos({ data: id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Iron feed</p>
          <h1 className="display text-3xl font-semibold">Work worth sharing</h1>
        </div>
        <div className="flex rounded-lg bg-secondary p-1">
          {(["global", "following"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "h-9 rounded-md px-3 text-xs font-medium capitalize",
                scope === s ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted-foreground",
              )}
            >
              {s === "global" ? "Discover" : "Following"}
            </button>
          ))}
        </div>
      </header>
      <div className="space-y-3">
        {(feed.data ?? []).map((item) => (
          <ActivityCard
            key={item.id}
            item={item}
            units={profile.data?.units ?? "metric"}
            onKudos={() => kudos.mutate(item.id)}
          />
        ))}
        {feed.data?.length === 0 && (
          <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            No published sessions yet. Finish a workout and it lands here.
          </p>
        )}
      </div>
    </div>
  );
}
