import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";

const intentSchema = z.object({
  email: z.string().email(),
  region: z.enum(["ng", "intl"]),
  interval: z.enum(["month", "year"]),
});

export const joinProWaitlist = createServerFn({ method: "POST" })
  .validator((input: unknown) => intentSchema.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    let userId: string | null = null;
    try {
      userId = (await getSessionUser())?.id ?? null;
    } catch {
      userId = null;
    }
    await sql`insert into pro_intents (user_id, email, region, interval)
              values (${userId}, ${data.email.toLowerCase()}, ${data.region}, ${data.interval})`;
    return {
      ok: true as const,
      processor: data.region === "ng" ? "Paystack" : "Stripe",
    };
  });

const checkoutSchema = z.object({
  email: z.string().email(),
  region: z.enum(["ng", "intl"]),
  interval: z.enum(["month", "year"]),
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    let userId: string | null = null;
    try {
      userId = (await getSessionUser())?.id ?? null;
    } catch {
      userId = null;
    }
    // If Stripe/Paystack keys missing, fallback to waitlist
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const hasPaystack = Boolean(process.env.PAYSTACK_SECRET_KEY);
    const hasProcessor = data.region === "ng" ? hasPaystack : hasStripe;
    if (!hasProcessor) {
      await sql`insert into pro_intents (user_id, email, region, interval) values (${userId}, ${data.email.toLowerCase()}, ${data.region}, ${data.interval})`;
      return { url: null as string | null, processor: data.region === "ng" ? "Paystack" : "Stripe", fallback: true as const };
    }
    // Create real checkout url when keys present (lazy import to avoid hard dep)
    const origin = process.env.BETTER_AUTH_URL ?? "https://forgexyx.vercel.app";
    if (data.region === "intl" && hasStripe) {
      // @ts-ignore - optional dep, installed when STRIPE_SECRET_KEY set
      const Stripe = (await import("stripe").catch(() => null)) as unknown as { default: new (k: string) => { checkout: { sessions: { create: (o: unknown) => Promise<{ url: string | null }> } } } } | null;
      if (Stripe?.default) {
        const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY!);
        const price = data.interval === "year" ? process.env.STRIPE_PRICE_YEAR : process.env.STRIPE_PRICE_MONTH;
        if (price) {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer_email: data.email,
            line_items: [{ price, quantity: 1 }],
            success_url: `${origin}/today?checkout=success`,
            cancel_url: `${origin}/pricing?checkout=cancel`,
            metadata: { userId: userId ?? "", region: data.region },
          });
          return { url: session.url, processor: "Stripe" as const, fallback: false as const };
        }
      }
    }
    if (data.region === "ng" && hasPaystack) {
      // Paystack: initialize transaction, redirect to authorization_url
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          amount: (data.interval === "year" ? 39000 : 4900) * 100,
          callback_url: `${origin}/today?checkout=success`,
          metadata: { userId: userId ?? "", region: data.region, interval: data.interval },
        }),
      });
      const j = (await res.json()) as { status: boolean; data?: { authorization_url: string } };
      if (j.status && j.data?.authorization_url) {
        return { url: j.data.authorization_url, processor: "Paystack" as const, fallback: false as const };
      }
    }
    return { url: null as string | null, processor: data.region === "ng" ? "Paystack" : "Stripe", fallback: true as const };
  });

export const confirmDevUpgrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Dev-only: upgrade without payment when no processor keys (enables QA)
    if (process.env.STRIPE_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY) throw new Error("Dev upgrade disabled when processor keys are set");
    const sql = await getSql();
    await sql`update profiles set plan = 'pro', plan_updated_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const cancelPro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set plan = 'free', plan_updated_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const coachQuota = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const planRows = await sql<{ plan: string }>`
      select plan from profiles where user_id = ${context.userId} limit 1`;
    const plan = planRows[0]?.plan === "pro" ? "pro" : "free";
    const usedRows = await sql<{ c: number }>`
      select count(*)::int as c from coach_messages
      where user_id = ${context.userId} and role = 'user'
        and created_at >= date_trunc('week', now())`;
    const used = usedRows[0]?.c ?? 0;
    const limit = plan === "pro" ? Infinity : 5;
    return { plan, used, limit: plan === "pro" ? null : 5, remaining: plan === "pro" ? null : Math.max(0, limit - used) };
  });
