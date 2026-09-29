import { createFileRoute } from "@tanstack/react-router";
/** Retired billing endpoint: Forge currently offers free access. */
export const Route = createFileRoute("/api/webhook/stripe")({
  server: { handlers: { POST: () => new Response("Payments are not enabled", {status:410}) } },
});
