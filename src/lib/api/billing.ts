import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db.server";
import { coachWeekLimit, parseMembership, upgradesWhenExhausted } from "@/lib/billing";

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
