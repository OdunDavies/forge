import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Globe, Landmark } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinProWaitlist } from "@/lib/api/billing";
import {
  PLANS,
  PRICES,
  detectRegion,
  formatPrice,
  persistRegion,
  type BillingInterval,
  type BillingRegion,
} from "@/lib/billing";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const user = useCurrentUser();
  const [region, setRegion] = useState<BillingRegion>(() => detectRegion());
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const price = PRICES[region];
  const display = formatPrice(region, interval);
  const period = interval === "year" ? "/year" : "/month";

  const join = useMutation({
    mutationFn: () =>
      joinProWaitlist({
        data: { email: email.trim(), region, interval },
      }),
    onSuccess: (res) => {
      toast(`You're on the ${res.processor} list. We'll open checkout in your currency.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const switchRegion = (next: BillingRegion) => {
    setRegion(next);
    persistRegion(next);
  };

  const yearlySaving = useMemo(() => price.yearNote, [price.yearNote]);

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
          Pay in Naira at home. Dollars everywhere else.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Logging stays free. Pro is the coach that reads yesterday and rewrites tomorrow.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full bg-secondary p-1">
            <button
              type="button"
              onClick={() => switchRegion("ng")}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm",
                region === "ng" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Landmark className="size-3.5" />
              Nigeria · ₦
            </button>
            <button
              type="button"
              onClick={() => switchRegion("intl")}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm",
                region === "intl" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Globe className="size-3.5" />
              Rest of world · $
            </button>
          </div>
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
              Yearly · {yearlySaving}
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl bg-card p-6 shadow-[var(--shadow-border)]">
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

          <article className="relative rounded-2xl bg-card p-6 shadow-[var(--shadow-border-hover)]">
            <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
              Flagship
            </span>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Forge Pro</p>
            <h2 className="display mt-2 text-3xl font-semibold">{PLANS.pro.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PLANS.pro.blurb}</p>
            <p className="display mt-6 text-4xl tabular">
              {display}
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
            <form
              className="mt-8 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) {
                  toast.error("Add the email we’ll send checkout to.");
                  return;
                }
                join.mutate();
              }}
            >
              <Input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" type="submit" disabled={join.isPending}>
                {join.isPending
                  ? "Saving…"
                  : region === "ng"
                    ? `Continue with Paystack · ${display}`
                    : `Continue with Stripe · ${display}`}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Checkout opens in {price.currency}. Cancel any time. No charge until Paystack / Stripe keys are
              live on this project.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
