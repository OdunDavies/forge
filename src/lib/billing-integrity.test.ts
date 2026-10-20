import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  accessExpiry,
  applyPayment,
  processPaystackEvent,
  processStripeEvent,
  validPaystackSignature,
  validatePayment,
  type CheckoutIntent,
} from "./billing-integrity.server.ts";
import type { Sql } from "./db.server.ts";

const intent: CheckoutIntent = {
  id: "intent",
  user_id: "owner",
  processor: "paystack",
  interval: "month",
  amount: 490000,
  currency: "NGN",
  price_id: null,
  provider_reference: "intent",
  subscription_id: null,
};

test("Paystack signatures are exact authenticated hashes", () => {
  const signature = createHmac("sha512", "test-key").update("body").digest("hex");
  assert.equal(validPaystackSignature("body", signature, "test-key"), true);
  for (const invalid of ["", "x".repeat(128), signature.slice(1)])
    assert.equal(validPaystackSignature("body", invalid, "test-key"), false);
  assert.equal(validPaystackSignature("tampered", signature, "test-key"), false);
});

test("payment contract refuses owner/email substitution, incorrect amounts, currencies and references", () => {
  const payment = {
    processor: "paystack",
    owner: "owner",
    reference: "intent",
    amount: 490000,
    currency: "NGN",
  };
  validatePayment(intent, payment);
  for (const patch of [
    { owner: "victim" },
    { owner: undefined },
    { amount: 1 },
    { amount: "490000" },
    { currency: "USD" },
    { reference: "other" },
    { processor: "stripe" },
  ]) {
    assert.throws(() => validatePayment(intent, { ...payment, ...patch }));
  }
  assert.equal(accessExpiry("2026-01-31T12:00:00Z", "month"), "2026-02-28T12:00:00.000Z");
  assert.equal(accessExpiry("2024-02-29T12:00:00Z", "year"), "2025-02-28T12:00:00.000Z");
});

test("durable dedup, intent consumption, rollback and Stripe lifecycle use atomic SQL", async () => {
  const db = new PGlite();
  const sql = (async () => {
    throw new Error("Unexpected tagged query");
  }) as unknown as Sql;
  sql.query = async <T>(query: string, params: unknown[] = []) =>
    (await db.query<T>(query, params)).rows;
  try {
    // Isolated fixture schema, not application migrations or an external database.
    await db.exec(`create table profiles (user_id text primary key, plan text default 'free',
      plan_updated_at timestamptz, plan_expires_at timestamptz, billing_processor text,
      billing_interval text, stripe_subscription_id text);
      create table billing_checkouts (id text primary key, user_id text, processor text,
        interval text, amount int, currency text, price_id text, provider_reference text,
        subscription_id text, status text default 'pending');
      create table billing_events (processor text, event_id text, checkout_id text,
        primary key(processor,event_id));
      insert into profiles(user_id) values ('owner'),('victim');
      insert into billing_checkouts(id,user_id,processor,interval,amount,currency,provider_reference)
        values ('intent','owner','paystack','month',490000,'NGN','intent');`);
    const charge = {
      event: "charge.success",
      data: {
        id: 123,
        status: "success",
        reference: "intent",
        amount: 490000,
        currency: "NGN",
        paid_at: "2026-01-31T12:00:00Z",
        metadata: { intentId: "intent", userId: "owner" },
      },
    };
    await assert.rejects(
      processPaystackEvent(sql, { ...charge, data: { ...charge.data, amount: 1 } }),
    );
    await assert.rejects(
      processPaystackEvent(sql, {
        ...charge,
        data: { ...charge.data, metadata: { intentId: "intent", userId: "victim" } },
      }),
    );
    await processPaystackEvent(sql, charge);
    await processPaystackEvent(sql, charge);
    await processPaystackEvent(sql, {
      ...charge,
      data: { ...charge.data, id: 124, paid_at: "2026-03-01T12:00:00Z" },
    });
    assert.equal(
      (await sql.query<{ c: number }>("select count(*)::int c from billing_events"))[0].c,
      2,
    );
    const paid = (
      await sql.query<{ plan: string; plan_expires_at: Date }>(
        "select plan,plan_expires_at from profiles where user_id = 'owner'",
      )
    )[0];
    assert.equal(paid.plan, "pro");
    assert.equal(new Date(paid.plan_expires_at).toISOString(), "2026-02-28T12:00:00.000Z");
    assert.equal(
      (await sql.query<{ plan: string }>("select plan from profiles where user_id = 'victim'"))[0]
        .plan,
      "free",
    );
    await db.exec(
      "alter table profiles add constraint reject_pro check (plan = 'free') not valid;",
    );
    await assert.rejects(applyPayment(sql, intent, "rollback", "2027-01-01T00:00:00Z", null, true));
    assert.equal(
      (
        await sql.query<{ c: number }>(
          "select count(*)::int c from billing_events where event_id = 'rollback'",
        )
      )[0].c,
      0,
    );
    await db.exec(`alter table profiles drop constraint reject_pro;
      update billing_checkouts set processor='stripe', currency='USD', price_id='price',
        subscription_id='sub', provider_reference='session';
      update profiles set billing_processor='stripe',stripe_subscription_id='sub';`);
    const subscription = {
      id: "sub",
      status: "active",
      metadata: { intentId: "intent", userId: "owner" },
      items: { data: [{ price: { id: "price" }, current_period_end: 1800000000 }] },
    };
    const stripe = {
      subscriptions: { retrieve: async () => subscription },
    } as unknown as Parameters<typeof processStripeEvent>[1];
    const checkout = {
      id: "checkout-event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "session",
          subscription: "sub",
          mode: "subscription",
          payment_status: "paid",
          amount_total: 490000,
          currency: "usd",
          metadata: { intentId: "intent", userId: "owner" },
        },
      },
    };
    for (const patch of [
      { payment_status: "unpaid" },
      { amount_total: 1 },
      { currency: "ngn" },
      { metadata: { intentId: "intent", userId: "victim" } },
    ]) {
      await assert.rejects(
        processStripeEvent(sql, stripe, {
          ...checkout,
          data: { object: { ...checkout.data.object, ...patch } },
        }),
      );
    }
    const invoice = {
      id: "invoice-event",
      type: "invoice.paid",
      data: {
        object: {
          paid: true,
          amount_paid: 490000,
          currency: "usd",
          parent: { subscription_details: { subscription: "sub" } },
          lines: {
            data: [{ period: { end: 1800000000 }, pricing: { price_details: { price: "price" } } }],
          },
        },
      },
    };
    await processStripeEvent(sql, stripe, invoice);
    await processStripeEvent(sql, stripe, invoice);
    await assert.rejects(
      processStripeEvent(sql, stripe, {
        ...invoice,
        id: "wrong-amount",
        data: {
          object: { ...invoice.data.object, amount_paid: 1 },
        },
      }),
    );
    subscription.status = "canceled";
    await processStripeEvent(sql, stripe, {
      id: "cancel-event",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub" } },
    });
    assert.equal(
      (await sql.query<{ plan: string }>("select plan from profiles where user_id='owner'"))[0]
        .plan,
      "free",
    );
    await assert.rejects(processStripeEvent(sql, stripe, { ...invoice, id: "late-invoice" }));
    assert.equal(
      (await sql.query<{ plan: string }>("select plan from profiles where user_id='owner'"))[0]
        .plan,
      "free",
    );
  } finally {
    await db.close();
  }
});
