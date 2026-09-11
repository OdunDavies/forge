import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinProWaitlist } from "@/lib/api/billing";
import {
  PLANS,
  PRICES,
  formatPrice,
  useBillingRegion,
  type BillingInterval,
  type PaidMembership,
} from "@/lib/billing";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const user = useCurrentUser();
  const { region, setRegion, tz } = useBillingRegion();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const other: typeof region = region === "ng" ? "intl" : "ng";
  const price = PRICES[region];
  const period = interval === "year" ? "/year" : "/month";
  const proDisplay = formatPrice(region, interval, "pro");
  const maxDisplay = formatPrice(region, interval, "pro_max");

  const join = useMutation({
    mutationFn: (plan: PaidMembership) =>
      joinProWaitlist({
        data: { email: email.trim(), region, interval, plan },
      }),
    onSuccess: (res) => {
      toast(`You're on the ${res.processor} list for ${res.plan === "pro_max" ? "Pro Max" : "Pro"}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(plan: PaidMembership) {
    if (!email.trim()) {
      toast.error("Add the email we’ll send checkout to.");
      return;
    }
    join.mutate(plan);
  }

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
          Three ways to train. Pro is the one that pays for itself.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Free logs the work. Pro Max is unlimited chat. Pro sits in the middle — 40 coach
          asks a week and a rewrite after every session — at half the Max price. That’s the
          membership Forge is actually built around.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {price.place} pricing
          {tz ? ` · ${tz}` : ""}. Pro {formatPrice("ng", "month", "pro")}/mo in Nigeria ·{" "}
          {formatPrice("intl", "month", "pro")}/mo elsewhere.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full bg-secondary p-1">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={cn(
                "h-9 rounded-full px-4 text-sm",
                interval === "month" ? "bg-elevated text-foreground" : "text-muted-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={cn(
                "h-9 rounded-full px-4 text-sm",
                interval === "year" ? "bg-elevated text-foreground" : "text-muted-foreground",
              )}
            >
              Yearly · {price.pro.yearNote}
            </button>
          </div>
          <Input
            type="email"
            className="max-w-xs"
            placeholder="Email for checkout"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <article className="flex flex-col rounded-2xl bg-card p-6 shadow-[var(--shadow-border)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Start</p>
            <h2 className="display mt-2 text-3xl font-semibold">{PLANS.free.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PLANS.free.blurb}</p>
            <p className="display mt-6 text-4xl">
              {region === "ng" ? "₦0" : "$0"}
              <span className="ml-1 text-base font-sans text-muted-foreground">/forever</span>
            </p>
            <ul className="mt-6 space-y-2">
              {PLANS.free.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-go" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-8 w-full" variant="outline" asChild>
              <Link to="/login">Train free</Link>
            </Button>
          </article>

          <article className="relative flex flex-col rounded-2xl bg-card p-6 shadow-[var(--shadow-border-hover)] lg:-translate-y-2">
            <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
              Best value
            </span>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The loop</p>
            <h2 className="display mt-2 text-3xl font-semibold">{PLANS.pro.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PLANS.pro.blurb}</p>
            <p className="display mt-6 text-4xl tabular">
              {proDisplay}
              <span className="ml-1 text-base font-sans text-muted-foreground">{period}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {price.processor} · {price.processorHint}
            </p>
            <ul className="mt-6 space-y-2">
              {PLANS.pro.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-go" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-8 w-full"
              disabled={join.isPending}
              onClick={() => submit("pro")}
            >
              {join.isPending
                ? "Saving…"
                : region === "ng"
                  ? `Continue with Paystack · ${proDisplay}`
                  : `Continue with Stripe · ${proDisplay}`}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              40 asks covers a serious block. Max is only worth it if you live in the chat.
            </p>
          </article>

          <article className="flex flex-col rounded-2xl bg-card p-6 shadow-[var(--shadow-border)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">No cap</p>
            <h2 className="display mt-2 text-3xl font-semibold">{PLANS.pro_max.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PLANS.pro_max.blurb}</p>
            <p className="display mt-6 text-4xl tabular">
              {maxDisplay}
              <span className="ml-1 text-base font-sans text-muted-foreground">{period}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              About 2× Pro. Same {price.processor}.
            </p>
            <ul className="mt-6 space-y-2">
              {PLANS.pro_max.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-go" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-8 w-full"
              variant="outline"
              disabled={join.isPending}
              onClick={() => submit("pro_max")}
            >
              {join.isPending ? "Saving…" : `Join Pro Max waitlist · ${maxDisplay}`}
            </Button>
          </article>
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] lg:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Free is enough to start</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Log, learn the lifts, share a recap. Five coach questions a week. When those run
              out, Pro shows up — not before.
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pro is the value</p>
            <p className="mt-2 text-sm leading-relaxed">
              Forty asks a week is a full mesocycle of questions. Every finished session
              rewrites the next one. You pay once, the loop runs. That’s why Pro is marked
              best value — Max costs double for unlimited chat you may never use.
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Max if you never want a wall</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Unlimited coach, longer rewrites, first in line when Gemini is busy. It only
              appears on your profile after Pro’s 40 are gone.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Checkout opens in {price.currency}. Cancel any time.
        </p>
        <button
          type="button"
          className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setRegion(other)}
        >
          Not {price.place}? Show {PRICES[other].place} ({PRICES[other].symbol})
        </button>
      </section>
    </div>
  );
}
