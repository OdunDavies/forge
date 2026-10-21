import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchExercises } from "@/lib/api/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/library/")({ component: LibraryPage });

const MUSCLES = [
  "chest",
  "lats",
  "quadriceps",
  "hamstrings",
  "glutes",
  "shoulders",
  "biceps",
  "triceps",
  "abdominals",
];
const EQUIP = ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands"];

function LibraryPage() {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [withVideo, setWithVideo] = useState(true);
  const list = useInfiniteQuery({
    queryKey: ["library", q, muscle, equipment, withVideo],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchExercises({ data: { q, muscle, equipment, withVideo, limit: 36, offset: pageParam } }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total;

  return (
    <div>
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {total?.toLocaleString() ?? "—"} {withVideo ? "video demonstrations" : "movements"}
        </p>
        <h1 className="display text-3xl font-semibold">How to move</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Search a lift, open the cues, then add it to today’s session.
        </p>
      </header>
      <Input
        aria-label="Search exercises"
        placeholder="Bench, squat, face pull…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={withVideo}
          onChange={(event) => setWithVideo(event.target.checked)}
          className="size-5 accent-primary"
        />
        Only show video demonstrations
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle((x) => (x === m ? "" : m))}
            className={cn(
              "h-9 rounded-full px-3 text-xs capitalize",
              muscle === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EQUIP.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setEquipment((x) => (x === m ? "" : m))}
            className={cn(
              "h-9 rounded-full px-3 text-xs capitalize",
              equipment === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {list.isPending && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="grid grid-cols-[auto_1fr] gap-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]"
            >
              <div className="h-6 rounded-md bg-secondary" />
              <div className="h-6 rounded-md bg-secondary" />
              <div className="h-6 rounded-md bg-secondary" />
            </Skeleton>
          ))}
        </div>
      )}

      {list.isError && (
        <p className="mt-6 rounded-xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          The movement library could not load. Open this page again in a moment.
        </p>
      )}

      {!list.isPending && !list.isError && items.length === 0 && (
        <p className="mt-6 rounded-xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          No matching lifts. Clear the filters or try a simpler name like “row” or “press”.
          {withVideo && (
            <button
              type="button"
              className="mt-3 block min-h-11 underline"
              onClick={() => setWithVideo(false)}
            >
              Search all exercises
            </button>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((ex) => (
          <Link
            key={ex.id}
            to="/library/$id"
            params={{ id: ex.id }}
            className="flex gap-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-md bg-secondary">
              <div className="grid size-full place-items-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {ex.primaryMuscles[0] ?? "lift"}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium">{ex.name}</h2>
              {ex.demo && <span className="text-xs text-primary">Video demo</span>}
              <p className="mt-1 truncate text-xs capitalize text-muted-foreground">
                {ex.equipment} · {ex.level}
              </p>
              <div className="mt-2 flex gap-1">
                {ex.primaryMuscles.slice(0, 2).map((m) => (
                  <Badge key={m}>{m}</Badge>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {list.hasNextPage && (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
          className="mt-4 w-full rounded-md bg-secondary py-3 text-sm font-medium"
        >
          {list.isFetchingNextPage
            ? "Loading..."
            : `Load more (${(total ?? 0) - items.length} left)`}
        </button>
      )}
    </div>
  );
}
