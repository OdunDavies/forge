import { getSql } from "../db.server";
/** Atomic, shared across serverless instances; one row per account. */
export async function consumeAiBudget(userId: string) {
  if (!process.env.GEMINI_API_KEY?.trim()) return;
  const sql = await getSql();
  const accepted = await sql<{requests:number}>`
    insert into ai_rate_limits (user_id, window_start, requests)
    values (${userId}, date_trunc('hour', now()), 1)
    on conflict (user_id) do update set
      window_start = date_trunc('hour', now()),
      requests = case when ai_rate_limits.window_start < date_trunc('hour', now()) then 1 else ai_rate_limits.requests + 1 end
    where ai_rate_limits.window_start < date_trunc('hour', now()) or ai_rate_limits.requests < 30
    returning requests`;
  if (!accepted.length) throw new Error("You've reached the hourly coach limit. Please try again next hour.");
}
