// @ts-ignore route generated after next build
import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "node:crypto";
import { getSql } from "@/lib/db";

// @ts-ignore
export const Route = createFileRoute("/api/webhook/paystack" as never)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 200 });
        const body = await request.text();
        const hash = createHmac("sha512", secret).update(body).digest("hex");
        const sig = request.headers.get("x-paystack-signature") ?? "";
        if (hash !== sig) return new Response("bad sig", { status: 400 });
        try {
          const evt = JSON.parse(body) as { event: string; data: { customer?: { email?: string }; metadata?: { userId?: string } } };
          if (evt.event === "charge.success") {
            const userId = evt.data.metadata?.userId;
            const email = evt.data.customer?.email?.toLowerCase();
            const sql = await getSql();
            if (userId) await sql`update profiles set plan='pro', plan_updated_at=now() where user_id=${userId}`;
            else if (email) await sql`update profiles set plan='pro', plan_updated_at=now() where user_id in (select id from "user" where lower(email)=${email})`;
          }
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.warn("[paystack webhook]", e);
          return new Response("bad body", { status: 400 });
        }
      },
    },
  },
});
