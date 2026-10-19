import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { awardSession, loadProgression } from "@/lib/gamification/progression.server";
export type { ProgressionState, SessionRewards } from "@/lib/gamification/progression.server";

export const awardForSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ sessionId: z.number().int().positive() }).parse(input))
  .handler(async ({ context, data }) =>
    withTransaction((sql: Sql) => awardSession(sql, context.userId, data.sessionId)),
  );

export const getProgression = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadProgression(await getSql(), context.userId));
