import assert from "node:assert/strict";
import { test } from "node:test";
import { gateRequestSessionAllowed, sessionRequestHeaders } from "./gate-request.server.ts";

test("session verification forwards the gate JWT alongside cookie and bearer credentials", () => {
  const request = new Request("https://forge.example", {
    headers: {
      "x-grok-identity": "signed-gate-jwt",
      cookie: "session=cookie",
      authorization: "Bearer original",
      "x-forwarded-host": "forge.example",
      "x-forwarded-proto": "https",
      "x-untrusted": "ignore",
    },
  });
  const headers = sessionRequestHeaders(request, "forwarded");
  assert.equal(headers.get("x-grok-identity"), "signed-gate-jwt");
  assert.equal(headers.get("cookie"), "session=cookie");
  assert.equal(headers.get("authorization"), "Bearer forwarded");
  assert.equal(headers.get("x-untrusted"), null);
  assert.equal(sessionRequestHeaders(request).get("authorization"), "Bearer original");
});

test("a stale gate cookie or bearer session cannot authorize a different or missing request identity", () => {
  const accounts = [{ providerId: "grok-gate", accountId: "viewer-a" }];
  const identity = { sub: "viewer-a", email: null, name: null, teamId: null };
  assert.equal(gateRequestSessionAllowed(accounts, identity, true, "grok-gate"), true);
  assert.equal(
    gateRequestSessionAllowed(accounts, { ...identity, sub: "viewer-b" }, true, "grok-gate"),
    false,
  );
  assert.equal(gateRequestSessionAllowed(accounts, null, true, "grok-gate"), false);
  assert.equal(gateRequestSessionAllowed(accounts, null, false, "grok-gate"), false);
  assert.equal(
    gateRequestSessionAllowed(
      [{ providerId: "google", accountId: "google-user" }],
      null,
      false,
      "grok-gate",
    ),
    true,
  );
  assert.equal(gateRequestSessionAllowed([], identity, true, "grok-gate"), false);
});
