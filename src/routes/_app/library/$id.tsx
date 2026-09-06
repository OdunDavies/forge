import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getExercise } from "@/lib/api/library";
import { addExerciseToSession, getActiveSession, startEmptySession } from "@/lib/api/sessions";

export const Route = createFileRoute("/_app/library/$id")({ component: ExercisePage });

function ExercisePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ex = useQuery({ queryKey: ["exercise", id], queryFn: () => getExercise({ data: id }) });
  const session = useQuery({ queryKey: ["active-session"], queryFn: () => getActiveSession() });

  const add = useMutation({
    mutationFn: async () => {
      if (!ex.data) return;
      let sid = session.data?.id;
      if (!sid) {
        const s = await startEmptySession({ data: "Open session" });
        sid = s.id;
      }
      await addExerciseToSession({
        data: { sessionId: sid, exerciseId: ex.data.id, exerciseName: ex.data.name, sets: 3 },
      });
      await qc.invalidateQueries({ queryKey: ["active-session"] });
      await navigate({ to: "/log" });
    },
  });

  if (!ex.data) {
    return <p className="text-sm text-muted-foreground">{ex.isPending ? "Loading…" : "Not found."}</p>;
  }

  return (
    <article className="space-y-5">
      <Link to="/library" className="text-sm text-muted-foreground">
        ← Library
      </Link>
      {ex.data.imageUrl && (
        <img
          src={ex.data.imageUrl}
          alt=""
          className="aspect-[4/3] w-full rounded-xl object-cover shadow-[var(--shadow-border)]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {ex.data.equipment} · {ex.data.mechanic} · {ex.data.level}
        </p>
        <h1 className="display mt-1 text-3xl font-semibold">{ex.data.name}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ex.data.primaryMuscles.map((m) => (
            <Badge key={m} variant="steel">
              {m}
            </Badge>
          ))}
          {ex.data.secondaryMuscles.map((m) => (
            <Badge key={m}>{m}</Badge>
          ))}
        </div>
      </div>
      <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {ex.data.instructions.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular text-foreground">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <Button onClick={() => add.mutate()} disabled={add.isPending}>
        Add to session
      </Button>
    </article>
  );
}
