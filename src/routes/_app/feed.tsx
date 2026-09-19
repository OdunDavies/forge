import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActivityCard } from "@/components/social/activity-card";
import { Input } from "@/components/ui/input";
import { getMyProfile } from "@/lib/api/profile";
import { countNewKudos, getFeed, searchUsers, toggleKudos } from "@/lib/api/social";
import { cn } from "@/lib/utils";
import type { FeedItem } from "@/lib/api/social";

export const Route = createFileRoute("/_app/feed")({ component: FeedPage });

function FeedPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"following" | "global">("global");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const notif = useQuery({ queryKey: ["notif"], queryFn: () => countNewKudos() });
  const search = useQuery({
    queryKey: ["searchUsers", debouncedQ],
    queryFn: () => searchUsers({ data: { q: debouncedQ } }),
    enabled: debouncedQ.length >= 2,
  });

  const feed = useQuery({
    queryKey: ["feed", scope, 0],
    queryFn: () => getFeed({ data: { scope, offset: 0 } }),
  });

  useEffect(() => {
    if (feed.data) {
      setItems(feed.data);
      setOffset(feed.data.length);
      setHasMore(feed.data.length === 20);
    }
  }, [feed.data]);

  useEffect(() => {
    // reset when scope changes
    setItems(feed.data ?? []);
    setOffset(feed.data?.length ?? 0);
    setHasMore((feed.data?.length ?? 0) === 20);
  }, [scope, feed.data]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await getFeed({ data: { scope, offset } });
      setItems((prev) => [...prev, ...next]);
      setOffset((prev) => prev + next.length);
      if (next.length < 20) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, hasMore, loadingMore, scope]);

  const kudos = useMutation({
    mutationFn: (id: number) => toggleKudos({ data: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["notif"] });
    },
  });

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Iron feed</p>
          <h1 className="display text-3xl font-semibold">Work worth sharing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/feed"
            className="relative grid size-9 place-items-center rounded-full bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {(notif.data?.count ?? 0) > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {notif.data!.count > 99 ? "99+" : notif.data!.count}
              </span>
            )}
          </Link>
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
        </div>
      </header>

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search handles…" className="pl-9" />
        {debouncedQ.length >= 2 && search.data && search.data.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md bg-card shadow-[var(--shadow-border)]">
            {search.data.map((u) => (
              <li key={u.handle}>
                <Link to="/u/$handle" params={{ handle: u.handle }} className="block px-3 py-2 text-sm hover:bg-secondary">
                  @{u.handle} <span className="text-muted-foreground">{u.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <ActivityCard
            key={item.id}
            item={item}
            units={profile.data?.units ?? "metric"}
            onKudos={() => kudos.mutate(item.id)}
          />
        ))}
        {items.length === 0 && !feed.isPending && (
          <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            No published sessions yet. Finish a workout and it lands here.
          </p>
        )}
        <div ref={sentinelRef} className="h-6" />
        {loadingMore && <p className="text-center text-sm text-muted-foreground">Loading more…</p>}
        {!hasMore && items.length > 0 && <p className="text-center text-xs text-muted-foreground">You&apos;re all caught up.</p>}
      </div>
    </div>
  );
}
