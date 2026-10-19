import assert from "node:assert/strict";
import { test } from "node:test";
import { authSecurityPolicy, devUpgradeAllowed } from "./security-policy.ts";

test("production requires an independent explicit signing secret and exact HTTPS origin", () => {
  const env = { NODE_ENV: "production", DATABASE_URL: "postgres://not-a-signing-secret" };
  assert.throws(() => authSecurityPolicy(env), /BETTER_AUTH_SECRET/);
  assert.throws(
    () => authSecurityPolicy({ ...env, BETTER_AUTH_SECRET: "s".repeat(32) }),
    /BETTER_AUTH_URL/,
  );
  for (const url of ["http://forge.example", "https://*.vercel.app"]) {
    assert.throws(() =>
      authSecurityPolicy({ ...env, BETTER_AUTH_SECRET: "s".repeat(32), BETTER_AUTH_URL: url }),
    );
  }
  assert.deepEqual(
    authSecurityPolicy({
      ...env,
      BETTER_AUTH_SECRET: "s".repeat(32),
      BETTER_AUTH_URL: "https://forge.example/auth",
    }),
    { production: true, secret: "s".repeat(32), origin: "https://forge.example" },
  );
});

test("development upgrade never enables itself just because payment keys are absent", () => {
  for (const env of [
    {},
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { NODE_ENV: "development", VERCEL_ENV: "production" },
    { NODE_ENV: "development", PAYSTACK_SECRET_KEY: "configured" },
  ]) {
    assert.equal(devUpgradeAllowed(env), false);
  }
  assert.equal(devUpgradeAllowed({ NODE_ENV: "development" }), true);
});
