import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { processPaystackEvent, validPaystackSignature } from "@/lib/billing-integrity.server";

export const Route = createFileRoute("/api/webhook/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
        if (!secret) return new Response("webhook not configured", { status: 503 });
        const body = await request.text();
        if (
          !validPaystackSignature(body, request.headers.get("x-paystack-signature") ?? "", secret)
        ) {
          return new Response("invalid signature", { status: 400 });
        }
        let event: unknown;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("invalid JSON", { status: 400 });
        }
        try {
          await processPaystackEvent(await getSql(), event);
          return new Response("ok");
        } catch {
          console.error("[paystack webhook] payment validation or persistence failed");
          return new Response("payment processing failed", { status: 503 });
        }
      },
    },
  },
});
