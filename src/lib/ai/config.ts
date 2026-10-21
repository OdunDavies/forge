export function getAiConfig(env: Record<string, string | undefined> = process.env) {
  const legacyKey = env.GEMINI_API_KEY?.trim();
  const nvidiaKey = env.NVIDIA_API_KEY?.trim();
  const provider =
    env.AI_PROVIDER?.trim().toLowerCase() ||
    (nvidiaKey || legacyKey?.startsWith("nvapi-")
      ? "nvidia"
      : legacyKey?.startsWith("AIza")
        ? "gemini"
        : undefined);
  if (provider !== "gemini" && provider !== "nvidia") return null;
  const apiKey = provider === "nvidia" ? nvidiaKey || legacyKey : legacyKey;
  if (!apiKey || (provider === "gemini" && apiKey.startsWith("nvapi-"))) return null;
  const model =
    provider === "nvidia"
      ? env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b"
      : env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const visionModel =
    provider === "nvidia" ? env.NVIDIA_VISION_MODEL?.trim() || "google/gemma-4-31b-it" : model;
  if (![model, visionModel].every((value) => /^[a-zA-Z0-9._/-]+$/.test(value))) return null;
  return { provider, apiKey, model, visionModel };
}
