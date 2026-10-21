import type { getAiConfig } from "./config.ts";

type Config = NonNullable<ReturnType<typeof getAiConfig>>;
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type NvidiaMessage = { role: "system" | "user" | "assistant"; content: string | Part[] };

export async function nvidiaChat(
  config: Config,
  messages: NvidiaMessage[],
  options: { maxTokens?: number; timeoutMs?: number; vision?: boolean; json?: boolean } = {},
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const unavailable = options.vision
    ? "Photo analysis is temporarily unavailable."
    : "Coach is temporarily unavailable.";
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: options.vision ? config.visionModel : config.model,
        messages: options.json
          ? [
              {
                role: "system",
                content: "Return only valid JSON. Do not include markdown or reasoning.",
              },
              ...messages,
            ].reduce<NvidiaMessage[]>((result, message) => {
              const last = result.at(-1);
              if (
                last?.role === message.role &&
                typeof last.content === "string" &&
                typeof message.content === "string"
              ) {
                last.content += `\n\n${message.content}`;
              } else result.push({ ...message } as NvidiaMessage);
              return result;
            }, [])
          : messages,
        max_tokens: Math.min(options.maxTokens ?? 1200, 8192),
        ...(/nemotron-3[.5-]/.test(options.vision ? config.visionModel : config.model)
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
        temperature: options.vision ? 0.2 : 0.4,
        stream: false,
      }),
      signal: AbortSignal.timeout(Math.min(options.timeoutMs ?? 45_000, 45_000)),
    });
    if (!response.ok) {
      console.warn("[ai] NVIDIA request failed", { status: response.status });
      return {
        ok: false,
        error:
          response.status === 429
            ? options.vision
              ? "Photo analysis is busy. Try again shortly."
              : "Coach is busy. Please try again shortly."
            : unavailable,
      };
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    };
    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    const text =
      typeof content === "string" ? content.replace(/<think>[\s\S]*?<\/think>/g, "").trim() : "";
    if (!text || choice?.finish_reason === "length") return { ok: false, error: unavailable };
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      error: options.vision
        ? "Photo analysis could not connect. Try again shortly."
        : "Coach could not connect. Please try again shortly.",
    };
  }
}
