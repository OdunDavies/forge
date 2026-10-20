import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityCard } from "@/components/social/activity-card";
import { Input } from "@/components/ui/input";
import { getMyProfile } from "@/lib/api/profile";
import { getFeed, searchUsers, toggleKudos } from "@/lib/api/social";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/feed")({ component: FeedPage });

function FeedPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"following" | "global">("global");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const search = useQuery({
    queryKey: ["searchUsers", debouncedQ],
    queryFn: () => searchUsers({ data: { q: debouncedQ } }),
    enabled: debouncedQ.length >= 2,
  });

  const feed = useInfiniteQuery({
    queryKey: ["feed", scope],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getFeed({ data: { scope, offset: pageParam } }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === 20 ? pages.reduce((count, page) => count + page.length, 0) : undefined,
  });
  const items = feed.data?.pages.flat() ?? [];

  const kudos = useMutation({
    mutationFn: (id: number) => toggleKudos({ data: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Iron feed</p>
          <h1 className="display text-3xl font-semibold">Work worth sharing</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-secondary p-1">
            {(["global", "following"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "h-9 rounded-md px-3 text-xs font-medium capitalize",
                  scope === s
                    ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                    : "text-muted-foreground",
                )}
              >
                {s === "global" ? "Discover" : "Following"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search athletes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search handles…"
          className="pl-9"
        />
        {debouncedQ.length >= 2 && search.data && search.data.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md bg-card shadow-[var(--shadow-border)]">
            {search.data.map((u) => (
              <li key={u.handle}>
                <Link
                  to="/u/$handle"
                  params={{ handle: u.handle }}
                  className="block px-3 py-2 text-sm hover:bg-secondary"
                >
                  @{u.handle} <span className="text-muted-foreground">{u.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {search.isError && <p role="alert">Search is unavailable. Please try again.</p>}
      {debouncedQ.length >= 2 && search.isSuccess && search.data.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">No athletes found.</p>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <ActivityCard
            key={item.id}
            item={item}
            units={profile.data?.units ?? "metric"}
            onKudos={() => kudos.mutate(item.id)}
          />
        ))}
        {feed.isPending && <p role="status">Loading workouts...</p>}
        {feed.isError && (
          <p role="alert">
            Could not load workouts.{" "}
            <button type="button" className="underline" onClick={() => void feed.refetch()}>
              Retry
            </button>
          </p>
        )}
        {items.length === 0 && !feed.isPending && !feed.isError && (
          <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            {scope === "following"
              ? "Follow athletes to see their shared workouts here."
              : "No shared workouts yet. Share a workout when you finish one."}
          </p>
        )}
        {feed.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
          >
            {feed.isFetchingNextPage ? "Loading..." : "Load more workouts"}
          </Button>
        )}
        {!feed.hasNextPage && items.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">You&apos;re all caught up.</p>
        )}
      </div>
    </div>
  );
}
