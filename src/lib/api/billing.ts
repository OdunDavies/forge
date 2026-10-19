import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { coachWeekLimit, parseMembership, upgradesWhenExhausted } from "@/lib/billing";
import { randomUUID } from "node:crypto";
import { stripeClient } from "../billing-integrity.server";
import { devUpgradeAllowed } from "../auth/security-policy";

const intentSchema = z.object({
  email: z.string().email(),
  region: z.enum(["ng", "intl"]),
  interval: z.enum(["month", "year"]),
  plan: z.enum(["pro", "pro_max"]).default("pro"),
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
    await sql`insert into pro_intents (user_id, email, region, interval, plan)
              values (${userId}, ${data.email.toLowerCase()}, ${data.region}, ${data.interval}, ${data.plan})`;
    return {
      ok: true as const,
      processor: data.region === "ng" ? "Paystack" : "Stripe",
      plan: data.plan,
    };
  });

const checkoutSchema = z.object({
  email: z.string().email(),
  region: z.enum(["ng", "intl"]),
  interval: z.enum(["month", "year"]),
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const user = await getSessionUser();
    if (!user?.email || user.id !== context.userId)
      throw new Error("Verified account required for checkout");
    const profiles = await sql<{
      stripe_subscription_id: string | null;
      plan_expires_at: string | null;
    }>`
      select stripe_subscription_id, plan_expires_at from profiles where user_id = ${user.id}`;
    if (!profiles[0]) throw new Error("Profile required for checkout");
    if (
      profiles[0].stripe_subscription_id ||
      (profiles[0].plan_expires_at && new Date(profiles[0].plan_expires_at).getTime() > Date.now())
    ) {
      throw new Error("An existing paid membership must end before another checkout");
    }
    const configuredOrigin = process.env.BETTER_AUTH_URL?.trim();
    if (!configuredOrigin) throw new Error("Checkout origin not configured");
    const origin = new URL(configuredOrigin).origin;
    if (!origin.startsWith("https://")) throw new Error("Checkout requires HTTPS");
    const id = randomUUID();
    if (data.region === "intl") {
      const stripe = await stripeClient();
      if (!process.env.STRIPE_WEBHOOK_SECRET?.trim())
        throw new Error("Stripe webhook not configured");
      const priceId = (
        data.interval === "year" ? process.env.STRIPE_PRICE_YEAR : process.env.STRIPE_PRICE_MONTH
      )?.trim();
      if (!priceId) throw new Error("Stripe price not configured");
      const price = await stripe.prices.retrieve(priceId);
      if (
        !price.unit_amount ||
        price.currency !== "usd" ||
        price.recurring?.interval !== data.interval ||
        price.recurring.interval_count !== 1
      ) {
        throw new Error("Unsupported Stripe price contract");
      }
      await sql`insert into billing_checkouts (id,user_id,processor,interval,amount,currency,price_id)
        values (${id},${user.id},'stripe',${data.interval},${price.unit_amount},'USD',${priceId})`;
      const metadata = { intentId: id, userId: user.id };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          payment_method_types: ["card"],
          customer_email: user.email,
          line_items: [{ price: priceId, quantity: 1 }],
          metadata,
          subscription_data: { metadata },
          success_url: `${origin}/today?checkout=success`,
          cancel_url: `${origin}/pricing?checkout=cancel`,
        },
        { idempotencyKey: id },
      );
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      await sql`update billing_checkouts set provider_reference = ${session.id} where id = ${id}`;
      return { url: session.url, processor: "Stripe" as const, fallback: false as const };
    }
    const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!secret) throw new Error("Paystack not configured");
    const amount = (data.interval === "year" ? 39000 : 4900) * 100;
    await sql`insert into billing_checkouts (id,user_id,processor,interval,amount,currency,provider_reference)
      values (${id},${user.id},'paystack',${data.interval},${amount},'NGN',${id})`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: "NGN",
        reference: id,
        callback_url: `${origin}/today?checkout=success`,
        metadata: { intentId: id, userId: user.id },
      }),
    });
    const result = (await res.json()) as {
      status: boolean;
      data?: { authorization_url: string; reference: string };
    };
    if (
      !res.ok ||
      !result.status ||
      !result.data?.authorization_url ||
      result.data.reference !== id
    ) {
      throw new Error("Paystack checkout initialization failed");
    }
    return {
      url: result.data.authorization_url,
      processor: "Paystack" as const,
      fallback: false as const,
    };
  });

export const confirmDevUpgrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Dev-only: upgrade without payment when no processor keys (enables QA)
    if (!devUpgradeAllowed(process.env)) throw new Error("Dev upgrade disabled");
    const sql = await getSql();
    await sql`update profiles set plan = 'pro', plan_updated_at = now(), plan_expires_at = now() + interval '1 day'
      where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const cancelPro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      billing_processor: string | null;
      stripe_subscription_id: string | null;
    }>`
      select billing_processor, stripe_subscription_id from profiles where user_id = ${context.userId}`;
    if (rows[0]?.billing_processor === "stripe") {
      if (!rows[0].stripe_subscription_id) throw new Error("Missing Stripe subscription binding");
      const stripe = await stripeClient();
      await stripe.subscriptions.update(rows[0].stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      // Paid access remains until its existing paid-through date; webhook ends it.
      return { ok: true as const };
    }
    // Paystack is a one-time purchase, not a recurring subscription.
    if (rows[0]?.billing_processor === "paystack") return { ok: true as const };
    await sql`update profiles set plan = 'free', plan_updated_at = now(), plan_expires_at = now()
      where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const coachQuota = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const planRows = await sql<{ plan: string }>`
      select case when plan_expires_at > now() then plan else 'free' end as plan
      from profiles where user_id = ${context.userId} limit 1`;
    const plan = parseMembership(planRows[0]?.plan);
    const usedRows = await sql<{ c: number }>`
      select count(*)::int as c from coach_messages
      where user_id = ${context.userId} and role = 'user'
        and created_at >= date_trunc('week', now())`;
    const used = usedRows[0]?.c ?? 0;
    const cap = coachWeekLimit(plan);
    const remaining = cap == null ? null : Math.max(0, cap - used);
    const exhausted = cap != null && remaining === 0;
    return {
      plan,
      used,
      limit: cap,
      remaining,
      exhausted,
      upgrades: exhausted ? upgradesWhenExhausted(plan) : [],
    };
  });
