import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireUser } from "@/components/layout/require-user";
import { getMyProfile } from "@/lib/api/profile";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user) && !isPending,
  });

  useEffect(() => {
    if (!user || isPending || profile.isPending) return;
    if (!profile.data?.onboardedAt) {
      void navigate({ to: "/onboarding" });
    }
  }, [user, isPending, profile.isPending, profile.data, navigate]);

  return (
    <RequireUser>
      <AppShell>
        {profile.isError ? (
          <div role="alert" className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center">
            <h1 className="display text-2xl font-semibold">We couldn&apos;t load your training profile</h1>
            <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again. Your saved workouts are safe.</p>
            <Button className="mt-5" onClick={() => void profile.refetch()}>Try again</Button>
          </div>
        ) : profile.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <Outlet />
        )}
      </AppShell>
    </RequireUser>
  );
}
