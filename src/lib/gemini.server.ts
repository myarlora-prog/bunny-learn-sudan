/**
 * Central AI completion helper. Uses owner-managed keys from `ai_keys`
 * (ordered by priority, enabled only), falling back to env keys and the
 * Lovable AI gateway. Each key is tried once per request — no endless retries.
 * Server-only: never import from client components. Never log key values.
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Options = {
  messages: ChatMessage[];
  /** Request strict JSON output */
  json?: boolean;
  model?: string;
};

export type AiResult =
  | { ok: true; content: string }
  | { ok: false; status: number; content: ""; error?: string };

export type Provider = "gemini" | "openai" | "openrouter" | "lovable";
export const PROVIDERS: Provider[] = ["gemini", "openai", "openrouter", "lovable"];

const GEMINI_MODEL = "gemini-2.5-flash";

async function errText(res: Response) {
  try { const t = await res.text(); return t.replace(/AIza[\w-]+|sk-[\w-]+/g, "***").slice(0, 300); } catch { return ""; }
}

async function callGemini(apiKey: string, model: string, opts: Options): Promise<AiResult> {
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = opts.messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }],
  }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.4, maxOutputTokens: 32768, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, content: "", error: await errText(res) };
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  return content ? { ok: true, content } : { ok: false, status: 200, content: "", error: "رد فارغ" };
}

async function callOpenAiCompatible(url: string, apiKey: string, model: string, opts: Options): Promise<AiResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...(opts.json ? { response_format: { type: "json_object" } } : {}), messages: opts.messages }),
  });
  if (!res.ok) return { ok: false, status: res.status, content: "", error: await errText(res) };
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  return content ? { ok: true, content } : { ok: false, status: 200, content: "", error: "رد فارغ" };
}

export function callProvider(provider: string, apiKey: string, model: string, opts: Options): Promise<AiResult> {
  if (provider === "gemini") return callGemini(apiKey, model || GEMINI_MODEL, opts);
  if (provider === "openai") return callOpenAiCompatible("https://api.openai.com/v1/chat/completions", apiKey, model, opts);
  if (provider === "openrouter") return callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", apiKey, model, opts);
  return callOpenAiCompatible("https://ai.gateway.lovable.dev/v1/chat/completions", apiKey, model || "google/gemini-2.5-flash", opts);
}

/** Errors worth moving to the next key: auth/quota/rate-limit/transient/empty. */
const shouldFallback = (status: number) => status === 0 || status === 200 || status === 401 || status === 402 || status === 403 || status === 404 || status === 408 || status === 429 || status >= 500 || status === 400;

/** Generate a completion through the central key list with ordered fallback. */
export async function aiComplete(opts: Options): Promise<AiResult> {
  let last: AiResult = { ok: false, status: 503, content: "", error: "لا توجد مفاتيح متاحة" };
  let keys: { id: string; provider: string; model: string; api_key: string }[] = [];
  let admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"] | null = null;
  try {
    admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data } = await admin.from("ai_keys").select("id,provider,model,api_key").eq("enabled", true).order("priority").order("created_at");
    keys = data ?? [];
  } catch { keys = []; }

  for (const k of keys.slice(0, 8)) {
    let r: AiResult;
    try { r = await callProvider(k.provider, k.api_key, opts.model ?? k.model, opts); }
    catch (e) { r = { ok: false, status: 0, content: "", error: e instanceof Error ? e.message.slice(0, 200) : "network" }; }
    await admin?.from("ai_keys").update({
      last_used_at: new Date().toISOString(),
      last_status: r.ok ? "ok" : `error ${r.status}`,
      last_error: r.ok ? null : (r.error ?? null),
    }).eq("id", k.id);
    if (r.ok) return r;
    last = r;
    if (!shouldFallback(r.status)) return r;
  }

  // Built-in fallbacks when no owner key succeeded.
  const envGemini = process.env["GEMINI_API_KEY"];
  if (envGemini) {
    const r = await callGemini(envGemini, GEMINI_MODEL, opts).catch(() => last);
    if (r.ok) return r;
    last = r;
  }
  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    const r = await callProvider("lovable", lovable, "google/gemini-2.5-flash", opts).catch(() => last);
    if (r.ok) return r;
    last = r;
  }
  return last;
}
