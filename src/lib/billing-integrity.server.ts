import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db";
import { z } from "zod";

export type CheckoutIntent = {
  id: string;
  user_id: string;
  processor: string;
  interval: "month" | "year";
  amount: number;
  currency: string;
  price_id: string | null;
  provider_reference: string | null;
  subscription_id: string | null;
};

export function validPaystackSignature(body: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function validatePayment(
  intent: CheckoutIntent,
  payment: {
    processor: string;
    owner: unknown;
    reference: unknown;
    amount: unknown;
    currency: unknown;
  },
) {
  if (
    intent.processor !== payment.processor ||
    intent.user_id !== payment.owner ||
    !intent.provider_reference ||
    intent.provider_reference !== payment.reference ||
    intent.amount !== payment.amount ||
    intent.currency !== payment.currency
  ) {
    throw new Error("Payment does not match server checkout intent");
  }
}

export function accessExpiry(paidAt: string, interval: "month" | "year"): string {
  const date = new Date(paidAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid paid timestamp");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (interval === "year" ? 12 : 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}

// Event receipt and entitlement changes commit in one statement on both SQL backends.
export async function applyPayment(
  sql: Sql,
  intent: CheckoutIntent,
  eventId: string,
  expiry: string,
  subscriptionId: string | null = null,
  recurring = false,
) {
  await sql.query(
    `with receipt as (
    insert into billing_events (processor, event_id, checkout_id) values ($1,$2,$3)
    on conflict do nothing returning checkout_id
  ), paid as (
    update billing_checkouts set status = 'paid', subscription_id = coalesce($5, subscription_id)
    where id in (select checkout_id from receipt) and (status = 'pending' or $6)
      and (processor <> 'stripe' or status = 'pending' or exists
        (select 1 from profiles p where p.user_id = billing_checkouts.user_id and p.stripe_subscription_id = $5))
    returning user_id, processor, interval
  ) update profiles p set plan = 'pro', plan_updated_at = now(),
    plan_expires_at = greatest(coalesce(p.plan_expires_at, $4::timestamptz), $4::timestamptz),
    billing_processor = paid.processor, billing_interval = paid.interval,
    stripe_subscription_id = $5
    from paid where p.user_id = paid.user_id`,
    [intent.processor, eventId, intent.id, expiry, subscriptionId, recurring],
  );
}

export type StripeSubscription = {
  id: string;
  status: string;
  metadata: Record<string, string>;
  items: { data: { price: { id: string }; current_period_end: number }[] };
};
type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };
type StripeClient = {
  prices: {
    retrieve(
      id: string,
    ): Promise<{
      id: string;
      unit_amount: number | null;
      currency: string;
      recurring: { interval: string; interval_count: number } | null;
    }>;
  };
  checkout: {
    sessions: {
      create(
        input: unknown,
        options: { idempotencyKey: string },
      ): Promise<{ id: string; url: string | null }>;
    };
  };
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscription>;
    update(id: string, input: unknown): Promise<StripeSubscription>;
  };
  webhooks: { constructEvent(body: string, signature: string, secret: string): StripeEvent };
};
export async function stripeClient(): Promise<StripeClient> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe not configured");
  // Optional until the parent installs the SDK. Missing SDK is a hard failure.
  const moduleName = "stripe";
  const mod = (await import(/* @vite-ignore */ moduleName)) as {
    default: new (key: string) => StripeClient;
  };
  return new mod.default(key);
}

export async function processPaystackEvent(sql: Sql, input: unknown) {
  const envelope = z.object({ event: z.string(), data: z.unknown() }).parse(input);
  if (envelope.event !== "charge.success") return;
  const payment = z
    .object({
      id: z.number().int().positive(),
      reference: z.string().min(1),
      status: z.literal("success"),
      amount: z.number().int().positive(),
      currency: z.literal("NGN"),
      paid_at: z.string().datetime({ offset: true }),
      metadata: z.object({ intentId: z.string().min(1), userId: z.string().min(1) }),
    })
    .parse(envelope.data);
  const rows = await sql.query<CheckoutIntent>("select * from billing_checkouts where id = $1", [
    payment.metadata.intentId,
  ]);
  const intent = rows[0];
  if (!intent) throw new Error("Unknown Paystack checkout");
  validatePayment(intent, {
    processor: "paystack",
    owner: payment.metadata.userId,
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
  });
  await applyPayment(
    sql,
    intent,
    `charge:${payment.id}`,
    accessExpiry(payment.paid_at, intent.interval),
  );
}

export async function processStripeEvent(sql: Sql, stripe: StripeClient, event: StripeEvent) {
  if (
    ![
      "checkout.session.completed",
      "invoice.paid",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return;
  const object = event.data.object;
  let subscriptionId: unknown;
  if (event.type === "checkout.session.completed") subscriptionId = object.subscription;
  else if (event.type === "invoice.paid") {
    const parent = object.parent as
      { subscription_details?: { subscription?: unknown } } | undefined;
    subscriptionId = parent?.subscription_details?.subscription;
  } else subscriptionId = object.id;
  if (typeof subscriptionId !== "string" || !subscriptionId)
    throw new Error("Missing Stripe subscription");
  // Retrieve current state so out-of-order lifecycle events cannot revive canceled access.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const rows = await sql.query<CheckoutIntent>(
    "select * from billing_checkouts where id = $1 and processor = 'stripe'",
    [subscription.metadata.intentId],
  );
  const intent = rows[0];
  if (
    !intent ||
    !intent.provider_reference ||
    subscription.metadata.userId !== intent.user_id ||
    subscription.items.data.length !== 1 ||
    subscription.items.data[0].price.id !== intent.price_id ||
    (intent.subscription_id && intent.subscription_id !== subscriptionId)
  ) {
    throw new Error("Stripe subscription does not match checkout contract");
  }
  if (event.type.startsWith("customer.subscription.")) {
    const revoked = ["canceled", "unpaid", "incomplete_expired", "paused"].includes(
      subscription.status,
    );
    await sql.query(
      `with receipt as (
      insert into billing_events (processor,event_id,checkout_id) values ('stripe',$1,$2)
      on conflict do nothing returning checkout_id
    ) update profiles set plan = 'free', plan_expires_at = now(), plan_updated_at = now(),
      stripe_subscription_id = null
      where user_id = $3 and stripe_subscription_id = $4 and $5
      and exists (select 1 from receipt)`,
      [event.id, intent.id, intent.user_id, subscriptionId, revoked],
    );
    return;
  }
  if (event.type === "checkout.session.completed") {
    const metadata = object.metadata as Record<string, unknown> | undefined;
    if (
      object.mode !== "subscription" ||
      object.payment_status !== "paid" ||
      metadata?.intentId !== intent.id
    ) {
      throw new Error("Stripe checkout is not paid or bound");
    }
    validatePayment(intent, {
      processor: "stripe",
      owner: metadata.userId,
      reference: object.id,
      amount: object.amount_total,
      currency: typeof object.currency === "string" ? object.currency.toUpperCase() : null,
    });
  } else if (
    object.paid !== true ||
    object.amount_paid !== intent.amount ||
    typeof object.currency !== "string" ||
    object.currency.toUpperCase() !== intent.currency
  ) {
    throw new Error("Stripe invoice does not match checkout amount/currency");
  }
  if (subscription.status !== "active") throw new Error("Stripe subscription is not active");
  let periodEnd = subscription.items.data[0].current_period_end;
  if (event.type === "invoice.paid") {
    const lines = z
      .object({
        data: z
          .array(
            z.object({
              period: z.object({ end: z.number().int().positive() }),
              pricing: z.object({ price_details: z.object({ price: z.string() }) }),
            }),
          )
          .length(1),
      })
      .parse(object.lines);
    if (lines.data[0].pricing.price_details.price !== intent.price_id)
      throw new Error("Unexpected Stripe invoice price");
    periodEnd = lines.data[0].period.end;
  }
  if (!Number.isInteger(periodEnd) || periodEnd <= 0)
    throw new Error("Missing Stripe paid-through date");
  await applyPayment(
    sql,
    intent,
    event.id,
    new Date(periodEnd * 1000).toISOString(),
    subscriptionId,
    event.type === "invoice.paid",
  );
}
