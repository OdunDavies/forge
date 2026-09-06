import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { grokChat } from "@/lib/ai/grok";
import { loadProfileByUserId } from "./profile";
import { loadPlan } from "./plan";

export const listCoachMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: number; role: string; content: string; created_at: string }>`
      select id, role, content, created_at from coach_messages
      where user_id = ${context.userId}
      order by created_at desc
      limit 30`;
  });

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ content: z.string().min(1).max(800) }).parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`insert into coach_messages (user_id, role, content)
              values (${context.userId}, 'user', ${data.content})`;

    const profile = await loadProfileByUserId(context.userId);
    const plan = await loadPlan(context.userId);
    const history = await sql<{ role: string; content: string }>`
      select role, content from coach_messages
      where user_id = ${context.userId}
      order by created_at desc limit 12`;
    const recent = await sql<{ title: string; volume_kg: unknown; pr_count: number; notes: string; started_at: string }>`
      select title, volume_kg, pr_count, notes, started_at from workout_sessions
      where user_id = ${context.userId} and completed_at is not null
      order by completed_at desc limit 6`;
    const prs = await sql<{ exercise_name: string; weight_kg: unknown; reps: number }>`
      select distinct on (lower(exercise_name)) exercise_name, weight_kg, reps
      from personal_records where user_id = ${context.userId}
      order by lower(exercise_name), estimated_1rm desc nulls last
      limit 8`;

    const system = `You are the strength coach inside Forge. Direct, precise, no hype, no emoji.
Coach from logged data. If they report pain or injury, reduce load/ROM and suggest a swap — never medical diagnosis.
Keep answers under 180 words unless they ask for a full rewrite.
Profile: ${JSON.stringify({
      goal: profile?.goal,
      experience: profile?.experience,
      injuries: profile?.injuries,
      equipment: profile?.equipment,
      daysPerWeek: profile?.daysPerWeek,
      focusMuscles: profile?.focusMuscles,
    })}
Active plan: ${plan ? `${plan.title} / ${plan.split}` : "none"}
Today: ${plan?.days.find((d) => d.weekday === new Date().getDay())?.title ?? "unknown"}
Recent sessions: ${JSON.stringify(recent)}
PRs: ${JSON.stringify(prs)}`;

    const chronological = [...history].reverse();
    const ai = await grokChat(
      [
        { role: "system", content: system },
        ...chronological.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      ],
      { maxTokens: 700 },
    );

    const reply = ai.ok
      ? ai.text
      : "Forge is offline right now. Log today's sets anyway — I'll read them when I'm back.";
    await sql`insert into coach_messages (user_id, role, content)
              values (${context.userId}, 'assistant', ${reply})`;
    return { reply };
  });
