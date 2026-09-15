type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
];

type GeminiPart = { text?: string; thought?: boolean };
type GeminiBody = {
  error?: { message?: string };
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
};

/**
 * Coach LLM. Gemini via GEMINI_API_KEY (Google AI Studio).
 * Kept as `grokChat` so existing coach/plan call sites stay unchanged.
 */
export async function grokChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; json?: boolean; timeoutMs?: number; modelLimit?: number } = {},
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "AI is not available in this environment" };

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of turns) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${m.content}`;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Continue." }] });
  }
  if (contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Ready." }] });
  }

  function payload(model: string, thinkingBudget: number) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.4,
      maxOutputTokens: opts.maxTokens ?? 1200,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    };
    if (model.startsWith("gemini-3")) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig,
    };
  }

  let lastError = "Coach unavailable";
  const models = GEMINI_MODELS.slice(0, Math.max(1, opts.modelLimit ?? GEMINI_MODELS.length));
  const timeoutMs = opts.timeoutMs ?? 28_000;

  for (const model of models) {
    const budgets = model.startsWith("gemini-3") ? [0, 256] : [0];
    for (const budget of budgets) {
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(payload(model, budget)),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        lastError = "Coach timed out";
        continue;
      }

      const body = (await res.json().catch(() => ({}))) as GeminiBody;
      if (res.status === 503 || res.status === 429) {
        lastError = `Coach unavailable (${res.status})`;
        break;
      }
      if (!res.ok) {
        lastError = body.error?.message?.slice(0, 180) || `Coach unavailable (${res.status})`;
        if (res.status === 404) break;
        continue;
      }

      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (text) return { ok: true, text };
      lastError = "Coach returned an empty reply";
    }
  }

  return { ok: false, error: lastError };
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
