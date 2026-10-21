import assert from "node:assert/strict";
import { test } from "node:test";
import { getAiConfig } from "./config.ts";
import { grokChat, comparePhysiquePhotos } from "./grok.ts";

test("provider selection supports NVIDIA keys in the legacy variable and never sends them to Gemini", () => {
  assert.equal(getAiConfig({ GEMINI_API_KEY: "nvapi-test-fixture" })?.provider, "nvidia");
  assert.equal(getAiConfig({ NVIDIA_API_KEY: "test-fixture" })?.provider, "nvidia");
  assert.equal(getAiConfig({ GEMINI_API_KEY: "AIza-test-fixture" })?.provider, "gemini");
  assert.equal(
    getAiConfig({ AI_PROVIDER: "nvidia", GEMINI_API_KEY: "legacy-fixture" })?.provider,
    "nvidia",
  );
  assert.equal(getAiConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "nvapi-test-fixture" }), null);
  assert.equal(getAiConfig({ AI_PROVIDER: "unknown", GEMINI_API_KEY: "test-fixture" }), null);
  assert.equal(getAiConfig({ NVIDIA_API_KEY: "test", NVIDIA_MODEL: "bad\nmodel" }), null);
  assert.equal(getAiConfig({}), null);
  assert.equal(getAiConfig({ GEMINI_API_KEY: "unrecognized-provider-key" }), null);
});

test("NVIDIA chat and labeled photo comparison use its API, separate models and safe failures", async () => {
  const originalFetch = globalThis.fetch;
  const names = [
    "GEMINI_API_KEY",
    "NVIDIA_API_KEY",
    "NVIDIA_MODEL",
    "NVIDIA_VISION_MODEL",
    "AI_PROVIDER",
  ];
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  process.env.GEMINI_API_KEY = "nvapi-test-fixture";
  try {
    let requests = 0;
    globalThis.fetch = async (url, options) => {
      requests++;
      assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions");
      assert.equal(
        (options?.headers as Record<string, string>).Authorization,
        "Bearer nvapi-test-fixture",
      );
      assert.equal((options?.headers as Record<string, string>)["x-goog-api-key"], undefined);
      const body = JSON.parse(String(options?.body));
      if (requests === 1) {
        assert.equal(body.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
        assert.equal(body.max_tokens, 6500);
        assert.match(body.messages[0].content, /valid JSON/);
        return Response.json({
          choices: [{ message: { content: '{"connected":true}' }, finish_reason: "stop" }],
        });
      }
      assert.equal(body.model, "google/gemma-4-31b-it");
      assert.match(body.messages[0].content, /Never promise an exact body match/);
      const parts = body.messages[1].content;
      assert.match(parts[1].text, /current physique/);
      assert.equal(parts[2].image_url.url, "data:image/jpeg;base64,current-bytes");
      assert.match(parts[3].text, /dream physique/);
      assert.equal(parts[4].image_url.url, "data:image/png;base64,goal-bytes");
      return Response.json({ choices: [{ message: { content: '{"focusMuscles":["back"]}' } }] });
    };
    assert.deepEqual(
      await grokChat([{ role: "user", content: "Test" }], { json: true, maxTokens: 6500 }),
      { ok: true, text: '{"connected":true}' },
    );
    assert.equal(
      (
        await comparePhysiquePhotos(
          { mimeType: "image/jpeg", data: "current-bytes" },
          { mimeType: "image/png", data: "goal-bytes" },
          "beginner",
        )
      ).ok,
      true,
    );
    assert.equal(requests, 2);
    for (const status of [401, 403, 429, 500]) {
      globalThis.fetch = async () => new Response("sensitive upstream diagnostics", { status });
      const result = await grokChat([{ role: "user", content: "Test" }]);
      assert.equal(result.ok, false);
      assert.doesNotMatch(JSON.stringify(result), /sensitive|nvapi/);
    }
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ message: { content: "partial reply" }, finish_reason: "length" }],
      });
    assert.equal((await grokChat([{ role: "user", content: "Test" }])).ok, false);
    globalThis.fetch = async () => {
      throw new Error("private diagnostics");
    };
    assert.equal((await grokChat([{ role: "user", content: "Test" }])).ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
