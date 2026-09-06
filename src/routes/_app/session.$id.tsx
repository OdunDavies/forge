import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionSummary } from "@/components/workout/session-summary";
import { getMyProfile } from "@/lib/api/profile";
import { getSessionById, saveSessionPhoto } from "@/lib/api/sessions";
import { addComment, listComments, toggleKudos } from "@/lib/api/social";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatKg } from "@/lib/utils";

export const Route = createFileRoute("/_app/session/$id")({ component: SessionPage });

function SessionPage() {
  const { id } = Route.useParams();
  const sessionId = Number(id);
  const qc = useQueryClient();
  const me = useCurrentUser();
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const session = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSessionById({ data: sessionId }),
  });
  const comments = useQuery({
    queryKey: ["comments", sessionId],
    queryFn: () => listComments({ data: sessionId }),
  });
  const [body, setBody] = useState("");
  const units = profile.data?.units ?? "metric";

  const kudos = useMutation({
    mutationFn: () => toggleKudos({ data: sessionId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["session"] }),
  });
  const comment = useMutation({
    mutationFn: () => addComment({ data: { activityId: sessionId, body } }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["comments", sessionId] });
    },
  });
  const photo = useMutation({
    mutationFn: (photoUrl: string) => saveSessionPhoto({ data: { sessionId, photoUrl } }),
    onSuccess: (s) => qc.setQueryData(["session", sessionId], s),
  });

  const s = session.data;
  if (!s) return <p className="text-sm text-muted-foreground">{session.isPending ? "Loading…" : "Not found."}</p>;
  const isOwner = Boolean(me && s.userId === me.id);

  return (
    <article className="space-y-5">
      <Link to="/feed" className="text-sm text-muted-foreground">
        ← Feed
      </Link>
      {s.completedAt && (
        <SessionSummary
          session={s}
          units={units}
          isOwner={isOwner}
          onPhoto={async (dataUrl) => {
            await photo.mutateAsync(dataUrl);
          }}
        />
      )}
      {!s.completedAt && (
        <header>
          <h1 className="display text-3xl font-semibold">{s.title}</h1>
          <p className="mt-1 text-sm tabular text-muted-foreground">In progress</p>
        </header>
      )}
      <ul className="space-y-2 text-sm">
        {s.sets
          .filter((x) => x.completed)
          .map((set) => (
            <li key={set.id} className="flex justify-between gap-3 rounded-md bg-card px-3 py-2">
              <span>
                {set.exerciseName} · set {set.setIndex}
              </span>
              <span className="tabular">
                {set.weightKg != null ? formatKg(set.weightKg, units) : "BW"} × {set.reps}
                {set.isPr ? " PR" : ""}
              </span>
            </li>
          ))}
      </ul>
      {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
      <Button variant="outline" onClick={() => kudos.mutate()}>
        Give kudos
      </Button>
      <section>
        <h2 className="display text-lg font-semibold">Comments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(comments.data ?? []).map((c) => (
            <li key={c.id} className="rounded-md bg-secondary px-3 py-2">
              <span className="font-medium">{c.display_name}</span>
              <p className="text-muted-foreground">{c.body}</p>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) comment.mutate();
          }}
        >
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something useful" />
          <Button type="submit" disabled={comment.isPending}>
            Post
          </Button>
        </form>
      </section>
    </article>
  );
}
