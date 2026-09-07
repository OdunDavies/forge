import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, Brain, Dumbbell, Radio, Timer } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { catalogStats } from "@/lib/api/library";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatPrice, useBillingRegion } from "@/lib/billing";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const stats = useQuery({ queryKey: ["catalog-stats"], queryFn: () => catalogStats() });
  const { region } = useBillingRegion();
  const localPrice = formatPrice(region, "month");


  if (!isPending && user) return <Navigate to="/today" />;

  const count = stats.data?.count ?? 1500;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/login">Join Forge</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Strength social · AI coach · Mission log
          </p>
          <h1 className="display max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
            The training OS for people who lift.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Strava energy, built for barbells. Log sets in seconds. Let Forge rewrite tomorrow from
            yesterday’s data, injuries, and PRs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/login">
                Start your first block
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">Pro {localPrice}/mo</Link>
            </Button>
          </div>
          <dl className="mt-14 grid grid-cols-3 gap-4 max-w-xl">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Movements</dt>
              <dd className="display mt-1 text-2xl tabular">{count.toLocaleString()}+</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Coach</dt>
              <dd className="display mt-1 text-2xl">Forge</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Social</dt>
              <dd className="display mt-1 text-2xl">Kudos</dd>
            </div>
          </dl>
        </div>

        <aside className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/canva-logo.png"
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-lg object-cover"
              />
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mission board</p>
                <p className="display text-lg font-semibold">Upper A · live</p>
              </div>
            </div>
            <span className="rounded-full bg-go/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-go">
              Ready
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={`${d}-${i}`}
                className={`rounded-md py-2 text-center text-[11px] ${
                  i === 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          <ul className="mt-5 divide-y divide-border text-sm">
            {[
              ["Barbell Bench Press", "4 × 6"],
              ["Bent Over Row", "4 × 8"],
              ["Seated Military Press", "3 × 8"],
              ["Lat Pulldown", "3 × 10"],
            ].map(([name, dose]) => (
              <li key={name} className="flex items-baseline justify-between gap-3 py-3">
                <span>{name}</span>
                <span className="tabular text-muted-foreground">{dose}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Forge reads last session, injuries, and energy — then retunes the next lift, not the whole
            month.
          </p>
        </aside>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Timer,
              title: "Log in seconds",
              body: "Today’s work is already loaded. Tap weight, tap reps, lock the set.",
            },
            {
              icon: Brain,
              title: "Forge coaches you",
              body: "The model reads your log, injuries, and energy, then retunes the next session.",
            },
            {
              icon: Dumbbell,
              title: "Full movement library",
              body: "Thousands of lifts with images and step-by-step cues so you know how to move.",
            },
            {
              icon: Radio,
              title: "Iron feed",
              body: "Publish a session. Give kudos. Follow lifters the way runners follow miles.",
            },
          ].map((f) => (
            <article key={f.title} className="bg-background p-6">
              <f.icon className="mb-4 size-5 text-steel" />
              <h2 className="display text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-5 py-10 text-xs text-muted-foreground">
        <span>Forge · train like a mission</span>
        <span>Powered by Grok</span>
      </footer>
    </div>
  );
}
