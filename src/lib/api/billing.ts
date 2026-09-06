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
