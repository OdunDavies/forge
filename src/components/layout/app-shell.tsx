import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  LayoutGrid,
  Radio,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Today", icon: LayoutGrid },
  { to: "/log", label: "Log", icon: Dumbbell },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/feed", label: "Feed", icon: Radio },
  { to: "/coach", label: "Coach", icon: Sparkles },
] as const;

const DESKTOP_EXTRA = [{ to: "/plan", label: "Plan", icon: CalendarDays }] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-background px-4 py-5 lg:flex">
        <Link to="/today" className="mb-8 px-1">
          <Wordmark />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {[...NAV, ...DESKTOP_EXTRA].map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/profile"
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
              pathname === "/profile"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <UserRound className="size-4" />
            Profile
          </Link>
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          {isPending ? (
            <div className="h-8 w-full animate-pulse rounded-full bg-secondary" />
          ) : (
            user && <UserButton />
          )}
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-border bg-background/85 px-4 py-2 safe-area-inset-top lg:hidden">
          <Link to="/today">
            <Wordmark />
          </Link>
          <Link to="/profile" className="grid size-11 place-items-center text-muted-foreground">
            <UserRound className="size-5" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
