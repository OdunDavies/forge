import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogStats, searchExercises } from "@/lib/api/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/library/")({ component: LibraryPage });

const MUSCLES = ["chest", "lats", "quadriceps", "hamstrings", "glutes", "shoulders", "biceps", "triceps", "abdominals"];
const EQUIP = ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands"];

function LibraryPage() {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const stats = useQuery({ queryKey: ["catalog-stats"], queryFn: () => catalogStats() });
  const list = useQuery({
    queryKey: ["library", q, muscle, equipment],
    queryFn: () => searchExercises({ data: { q, muscle, equipment, limit: 36 } }),
  });

  const items = list.data?.items ?? [];

  return (
    <div>
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {stats.data?.count?.toLocaleString() ?? "—"} movements
        </p>
        <h1 className="display text-3xl font-semibold">How to move</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Search a lift, open the cues, then add it to today’s session. This is the form guide — not a shopping list.
        </p>
      </header>
      <Input placeholder="Bench, squat, face pull…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle((x) => (x === m ? "" : m))}
            className={cn(
              "h-9 rounded-full px-3 text-xs capitalize",
              muscle === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
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
              equipment === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {list.isPending && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
              {ex.imageUrl ? (
                <img
                  src={ex.imageUrl}
                  alt=""
                  className="size-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="grid size-full place-items-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {ex.primaryMuscles[0] ?? "lift"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium">{ex.name}</h2>
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
    </div>
  );
}
