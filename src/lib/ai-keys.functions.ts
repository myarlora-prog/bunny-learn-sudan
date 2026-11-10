import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callProvider, PROVIDERS } from "@/lib/gemini.server";

type Ctx = { supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown }> } };
async function owner(context: Ctx) {
  const { data } = await context.supabase.rpc("is_admin");
  if (!data) throw new Error("Forbidden");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
const mask = (k: string) => (k.length <= 8 ? "••••" : `${k.slice(0, 4)}••••••${k.slice(-4)}`);

export const listAiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await owner(context);
    const { data, error } = await db.from("ai_keys").select("*").order("priority").order("created_at");
    if (error) throw new Error("تعذر تحميل المفاتيح");
    return (data ?? []).map(({ api_key, ...k }) => ({ ...k, masked: mask(api_key) }));
  });

type SaveInput = { id?: string; label: string; provider: string; model: string; apiKey?: string; enabled: boolean };
export const saveAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: SaveInput) => {
    if (!PROVIDERS.includes(i.provider as never)) throw new Error("مزوّد غير مدعوم");
    if (!i.model?.trim()) throw new Error("حدد الموديل");
    if (!i.id && !i.apiKey?.trim()) throw new Error("أدخل المفتاح");
    return { id: i.id, label: String(i.label ?? "").slice(0, 80), provider: i.provider, model: i.model.trim().slice(0, 120), apiKey: i.apiKey?.trim().slice(0, 500), enabled: !!i.enabled };
  })
  .handler(async ({ data, context }) => {
    const db = await owner(context);
    const row = { label: data.label, provider: data.provider, model: data.model, enabled: data.enabled, updated_at: new Date().toISOString(), ...(data.apiKey ? { api_key: data.apiKey, last_status: null, last_error: null } : {}) };
    if (data.id) {
      const { error } = await db.from("ai_keys").update(row).eq("id", data.id);
      if (error) throw new Error("تعذر الحفظ");
    } else {
      const { count } = await db.from("ai_keys").select("id", { count: "exact", head: true });
      const { error } = await db.from("ai_keys").insert({ ...row, api_key: data.apiKey!, priority: (count ?? 0) + 1 });
      if (error) throw new Error("تعذر الحفظ");
    }
    return { ok: true };
  });

export const deleteAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => ({ id: String(i.id) }))
  .handler(async ({ data, context }) => {
    const db = await owner(context);
    const { error } = await db.from("ai_keys").delete().eq("id", data.id);
    if (error) throw new Error("تعذر الحذف");
    return { ok: true };
  });

/** Saves a full order: first id becomes the primary key, the rest are backups in order. */
export const reorderAiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => ({ ids: (i.ids ?? []).map(String).slice(0, 50) }))
  .handler(async ({ data, context }) => {
    const db = await owner(context);
    for (let p = 0; p < data.ids.length; p++) await db.from("ai_keys").update({ priority: p + 1 }).eq("id", data.ids[p]!);
    return { ok: true };
  });

export const testAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => ({ id: String(i.id) }))
  .handler(async ({ data, context }) => {
    const db = await owner(context);
    const { data: k } = await db.from("ai_keys").select("provider,model,api_key").eq("id", data.id).single();
    if (!k) throw new Error("المفتاح غير موجود");
    const started = Date.now();
    const r = await callProvider(k.provider, k.api_key, k.model, { messages: [{ role: "user", content: "Reply with: OK" }] })
      .catch((e) => ({ ok: false as const, status: 0, content: "" as const, error: e instanceof Error ? e.message.slice(0, 200) : "network" }));
    const status = r.ok ? "ok" : `error ${r.status}`;
    const error = r.ok ? null : ("error" in r ? r.error ?? null : null);
    await db.from("ai_keys").update({ last_used_at: new Date().toISOString(), last_status: status, last_error: error }).eq("id", data.id);
    return { ok: r.ok, status, error, ms: Date.now() - started };
  });
