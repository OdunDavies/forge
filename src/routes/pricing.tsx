import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Dumbbell, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/pricing")({ component: PricingPage });
function PricingPage() {
  return <div className="min-h-dvh">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link to="/"><Wordmark /></Link><Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button></header>
    <main className="mx-auto grid max-w-5xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center">
      <div><p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Built for the work</p><h1 className="display mt-5 text-5xl font-semibold leading-tight">More training.<br />Less friction.</h1><p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">Your log, your plan, and your progress. Everything you need to keep showing up, together in Forge.</p><div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground"><Dumbbell className="size-5" /> All experience levels welcome.</div></div>
      <section className="rounded-2xl border border-border bg-card p-7 sm:p-9" aria-labelledby="membership-title"><div className="flex items-center justify-between"><h2 id="membership-title" className="display text-2xl font-semibold">Forge membership</h2><Sparkles className="size-5 text-primary" /></div><p className="display mt-6 text-5xl font-semibold">Free</p><p className="mt-3 text-sm text-muted-foreground">No card. No checkout. Start with your next session.</p><ul className="my-8 space-y-4">{["Workout logging and personal records", "A plan matched to your schedule and equipment", "Exercise library with movement instructions", "AI coaching when the coach is available", "Training history and shareable recaps", "A community of lifters"].map(feature => <li key={feature} className="flex gap-3 text-sm"><Check className="size-4 shrink-0 text-go" aria-hidden="true" />{feature}</li>)}</ul><Button size="lg" asChild className="w-full"><Link to="/login">Start training<ArrowRight className="size-4" /></Link></Button><p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">AI requests are subject to fair-use limits.</p></section>
    </main>
  </div>;
}
