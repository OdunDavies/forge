// @ts-ignore route generated after next build
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/webhook/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("webhook not configured", { status: 200 });
        const sig = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        // lazy verify without hard dep if stripe missing
        try {
          // @ts-ignore optional stripe
          const mod = (await import(/* @vite-ignore */ "stripe").catch(() => null)) as unknown as {
            default: new (k: string) => { webhooks: { constructEvent: (b: string, s: string, sec: string) => { type: string; data: { object: { customer_email?: string; metadata?: { userId?: string } } } } } };
          } | null;
          if (!mod?.default) return new Response("stripe dep missing", { status: 200 });
          const stripe = new mod.default(process.env.STRIPE_SECRET_KEY!);
          const event = stripe.webhooks.constructEvent(body, sig, secret);
          if (event.type === "checkout.session.completed") {
            const email = event.data.object.customer_email?.toLowerCase();
            const userId = event.data.object.metadata?.userId;
            const sql = await getSql();
            if (userId) {
              await sql`update profiles set plan='pro', plan_updated_at=now() where user_id=${userId}`;
            } else if (email) {
              await sql`update profiles set plan='pro', plan_updated_at=now() where user_id in (select id from "user" where lower(email)=${email})`;
            }
          }
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.warn("[stripe webhook]", e);
          return new Response("invalid", { status: 400 });
        }
      },
    },
  },
});
