import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityCard } from "@/components/social/activity-card";
import { Button } from "@/components/ui/button";
import { followState, listUserActivities, toggleFollow, toggleKudos } from "@/lib/api/social";
import { getMyProfile, getProfileByHandle } from "@/lib/api/profile";

export const Route = createFileRoute("/_app/u/$handle")({ component: PublicProfile });

function PublicProfile() {
  const { handle } = Route.useParams();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const profile = useQuery({
    queryKey: ["profile", handle],
    queryFn: () => getProfileByHandle({ data: handle }),
  });
  const follow = useQuery({
    queryKey: ["follow", profile.data?.userId],
    queryFn: () => followState({ data: profile.data!.userId }),
    enabled: Boolean(profile.data),
  });
  const acts = useQuery({
    queryKey: ["acts", profile.data?.userId],
    queryFn: () => listUserActivities({ data: profile.data!.userId }),
    enabled: Boolean(profile.data),
  });
  const tog = useMutation({
    mutationFn: () => toggleFollow({ data: profile.data!.userId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["follow"] }),
  });
  const kudos = useMutation({
    mutationFn: (id: number) => toggleKudos({ data: id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["acts"] }),
  });

  const p = profile.data;
  if (!p) return <p className="text-sm text-muted-foreground">{profile.isPending ? "Loading…" : "Athlete not found."}</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">@{p.handle}</p>
          <h1 className="display text-3xl font-semibold">{p.displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{p.bio || `${p.goal ?? "Training"} · ${p.experience ?? ""}`}</p>
          <p className="mt-2 text-xs tabular text-muted-foreground">
            {follow.data?.followerCount ?? 0} followers · {follow.data?.followingCount ?? 0} following
          </p>
        </div>
        {!follow.data?.isSelf && (
          <Button variant={follow.data?.following ? "outline" : "default"} onClick={() => tog.mutate()}>
            {follow.data?.following ? "Following" : "Follow"}
          </Button>
        )}
      </header>
      <div className="space-y-3">
        {(acts.data ?? []).map((item) => (
          <ActivityCard
            key={item.id}
            item={item}
            units={me.data?.units ?? "metric"}
            onKudos={() => kudos.mutate(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
