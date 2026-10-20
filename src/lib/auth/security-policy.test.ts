import assert from "node:assert/strict";
import { test } from "node:test";
import { authSecurityPolicy } from "./security-policy.ts";

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
