import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { processStripeEvent, stripeClient } from "@/lib/billing-integrity.server";

export const Route = createFileRoute("/api/webhook/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        if (!secret) return new Response("webhook not configured", { status: 503 });
        let stripe;
        try {
          stripe = await stripeClient();
        } catch {
          return new Response("stripe unavailable", { status: 503 });
        }
        const body = await request.text();
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            body,
            request.headers.get("stripe-signature") ?? "",
            secret,
          );
        } catch {
          return new Response("invalid signature", { status: 400 });
        }
        try {
          await processStripeEvent(await getSql(), stripe, event);
          return new Response("ok");
        } catch {
          console.error("[stripe webhook] payment validation or persistence failed");
          return new Response("payment processing failed", { status: 503 });
        }
      },
    },
  },
});
