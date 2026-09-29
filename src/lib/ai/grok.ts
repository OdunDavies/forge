type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return {ok:false,error:"Coach is not configured correctly"};
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method:"POST", headers:{"Content-Type":"application/json", "x-goog-api-key":apiKey},
      body:JSON.stringify({
        ...(system ? {systemInstruction:{parts:[{text:system}]}} : {}), contents,
        generationConfig:{temperature:0.4,maxOutputTokens:opts.maxTokens ?? 1200,...(opts.json ? {responseMimeType:"application/json"} : {})},
      }), signal:AbortSignal.timeout(Math.min(opts.timeoutMs ?? 20_000, 25_000)),
    });
    if (!response.ok) return {ok:false,error:response.status === 429 ? "Coach is busy. Please try again shortly." : "Coach is temporarily unavailable."};
    const body = await response.json() as GeminiBody;
    const text = (body.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? "").join("").trim();
    return text ? {ok:true,text} : {ok:false,error:"Coach returned an empty reply. Please try again."};
  } catch { return {ok:false,error:"Coach could not connect. Please try again shortly."}; }
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
