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
    queryKey: ["me", user?.id],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user) && !isPending,
  });

  useEffect(() => {
    if (!user || isPending || !profile.isSuccess) return;
    if (!profile.data?.onboardedAt) {
      void navigate({ to: "/onboarding" });
    }
  }, [user, isPending, profile.isSuccess, profile.data, navigate]);

  return (
    <RequireUser>
      <AppShell>
        {profile.isError ? (
          <div className="space-y-4">
            <p role="alert">Could not load your profile. {profile.error.message}</p>
            <Button disabled={profile.isFetching} onClick={() => void profile.refetch()}>Retry</Button>
          </div>
        ) : profile.isPending || !profile.data?.onboardedAt ? (
          <div role="status" aria-label="Loading your profile" className="space-y-4">
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
