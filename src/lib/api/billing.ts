import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { coachWeekLimit, parseMembership, upgradesWhenExhausted } from "@/lib/billing";

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
    try {
      await sql`insert into pro_intents (user_id, email, region, interval, plan)
                values (${userId}, ${data.email.toLowerCase()}, ${data.region}, ${data.interval}, ${data.plan})`;
    } catch {
      await sql`insert into pro_intents (user_id, email, region, interval)
                values (${userId}, ${data.email.toLowerCase()}, ${data.region}, ${data.interval})`;
    }
    return {
      ok: true as const,
      processor: data.region === "ng" ? "Paystack" : "Stripe",
      plan: data.plan,
    };
  });

export const coachQuota = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const planRows = await sql<{ plan: string }>`
      select plan from profiles where user_id = ${context.userId} limit 1`;
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
