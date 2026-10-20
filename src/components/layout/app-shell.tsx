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
  { to: "/plan", label: "Plan", icon: CalendarDays },
  { to: "/log", label: "Log", icon: Dumbbell },
  { to: "/feed", label: "Feed", icon: Radio },
  { to: "/coach", label: "Coach", icon: Sparkles },
] as const;

const DESKTOP_EXTRA = [{ to: "/library", label: "Library", icon: BookOpen }] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();

  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-background px-4 py-5 lg:flex">
        <Link to="/today" className="mb-8 px-1">
          <Wordmark />
        </Link>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
          {[NAV[0], NAV[1], NAV[2], ...DESKTOP_EXTRA, NAV[3], NAV[4]].map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
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
              aria-current={pathname === "/profile" ? "page" : undefined}
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
          <Link to="/profile" aria-label="Your profile" className="grid size-11 place-items-center text-muted-foreground">
            <UserRound className="size-5" />
          </Link>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide transition-colors active:bg-secondary/60",
                active ? "text-primary" : "text-muted-foreground",
                item.to === "/log" && "-mt-3",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-xl", item.to === "/log" && "size-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20")}>
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
