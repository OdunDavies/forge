type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash"];

/**
 * Coach LLM. Gemini via GEMINI_API_KEY (Google AI Studio).
 * Kept as `grokChat` so existing coach/plan call sites stay unchanged.
 */
export async function grokChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; json?: boolean } = {},
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

  const payload = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: opts.maxTokens ?? 1200,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  let lastError = "Coach unavailable";
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(22000),
      });
    } catch {
      lastError = "Coach timed out";
      continue;
    }
    if (res.status === 503 || res.status === 429) {
      lastError = `Coach unavailable (${res.status})`;
      continue;
    }
    if (!res.ok) {
      lastError = `Coach unavailable (${res.status})`;
      continue;
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";
    if (!text) {
      lastError = "Coach returned an empty reply";
      continue;
    }
    return { ok: true, text };
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
