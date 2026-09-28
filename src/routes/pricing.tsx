import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Wordmark />
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Membership</p>
        <h1 className="display mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          All features are free
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Logging stays free. The coach that reads yesterday and rewrites tomorrow is also free.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          No payment required. Start logging your workouts today.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl bg-card p-6 shadow-[var(--shadow-border)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Start</p>
            <h2 className="display mt-2 text-3xl font-semibold">Free</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {/* Features come from PLANS.free in billing.ts */}
            </p>
            <ul className="mt-6 space-y-2">
              {/* PLANS.free.features.map would go here if we kept the grid, but we'll just list them static */}
              <li className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Prefilled logging from Today
              </li>
              <li className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> 3,700+ movement library
              </li>
              <li className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Unlimited coach questions
              </li>
              <li className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Retune session after you finish
              </li>
              <li className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Recap cards you can share
              </li>
            </ul>
            <Button className="mt-8 w-full" variant="outline" asChild>
              <Link to="/login">Train free</Link>
            </Button>
          </article>

          <article className="relative rounded-2xl bg-card p-6 shadow-[var(--shadow-border-hover)]">
            <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
              Free
            </span>
            <h2 className="display mt-2 text-3xl font-semibold">Free forever</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No payment required. All features available to every user.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              No checkout needed. Cancel any time.
            </p>
            <ul className="mt-6 space-y-2">
              <li className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Prefilled logging from Today
              </li>
              <li className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> 3,700+ movement library
              </li>
              <li className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Unlimited coach questions
              </li>
              <li className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Retune session after you finish
              </li>
              <li className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-go" /> Recap cards you can share
              </li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}