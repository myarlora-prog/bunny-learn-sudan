/**
 * Shared AI completion helper.
 * Uses the project's GEMINI_API_KEY (Google Generative Language API) when set,
 * and falls back to the Lovable AI gateway otherwise.
 * Server-only: never import from client components.
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Options = {
  messages: ChatMessage[];
  /** Request strict JSON output */
  json?: boolean;
  model?: string;
};

export type AiResult =
  | { ok: true; content: string }
  | { ok: false; status: number; content: "" };

const GEMINI_MODEL = "gemini-2.5-flash";

async function callGeminiDirect(apiKey: string, opts: Options): Promise<AiResult> {
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model ?? GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: 0.4,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!res.ok) return { ok: false, status: res.status, content: "" };
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content =
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  if (!content) return { ok: false, status: 200, content: "" };
  return { ok: true, content };
}

async function callLovableGateway(opts: Options): Promise<AiResult> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: opts.messages,
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, content: "" };
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) return { ok: false, status: 200, content: "" };
  return { ok: true, content };
}

/** Generate a text (or JSON) completion. Prefers GEMINI_API_KEY, falls back to the Lovable gateway. */
export async function aiComplete(opts: Options): Promise<AiResult> {
  const key = process.env["GEMINI_API_KEY"];
  if (key) {
    const direct = await callGeminiDirect(key, opts);
    if (direct.ok) return direct;
    // On auth errors the key itself is broken — surface it instead of silently masking.
    if (direct.status === 400 || direct.status === 401 || direct.status === 403) return direct;
    // Rate limit / overload / transient: try the gateway as a backup.
    const fallback = await callLovableGateway(opts);
    return fallback.ok ? fallback : direct;
  }
  return callLovableGateway(opts);
}
