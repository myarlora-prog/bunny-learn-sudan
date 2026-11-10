import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plug, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAiKey, listAiKeys, reorderAiKeys, saveAiKey, testAiKey } from "@/lib/ai-keys.functions";
import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", model: "gemini-3.5-flash" },
  { id: "openai", label: "OpenAI", model: "" },
  { id: "openrouter", label: "OpenRouter", model: "" },
  { id: "lovable", label: "Lovable AI", model: "google/gemini-3.8-flash" },
];
type Form = { id?: string; label: string; provider: string; model: string; apiKey: string; enabled: boolean };
const empty: Form = { label: "", provider: "gemini", model: "gemini-3.5-flash", apiKey: "", enabled: true };

export function AdminAiKeys() {
  const cache = useQueryClient();
  const list = useServerFn(listAiKeys), save = useServerFn(saveAiKey), del = useServerFn(deleteAiKey), reorder = useServerFn(reorderAiKeys), test = useServerFn(testAiKey);
  const keys = useQuery({ queryKey: ["ai-keys"], queryFn: () => list() });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => cache.invalidateQueries({ queryKey: ["ai-keys"] });
  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try { await fn(); if (ok) toast.success(ok); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); } finally { setBusy(null); }
  };
  const ids = (keys.data ?? []).map((k) => k.id);
  const move = (i: number, d: number) => { const n = [...ids]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; void run("order", () => reorder({ data: { ids: n } })); };
  const enabledIds = (keys.data ?? []).filter((k) => k.enabled).map((k) => k.id);

  if (keys.isLoading) return <Loader2 className="mx-auto animate-spin text-primary" />;
  if (keys.isError) return <p className="text-destructive">تعذر تحميل المفاتيح</p>;
  return <div className="flex flex-col gap-3">
    <p className="text-xs text-muted-foreground">تُجرّب المفاتيح المفعّلة بالترتيب: الأول أساسي والباقي احتياطي. عند فشل مفتاح (حصة، خطأ مؤقت، مفتاح غير صالح) يُنتقل للتالي مرة واحدة لكل مفتاح، ثم إلى الخدمة المدمجة. المفاتيح محفوظة على الخادم ولا تظهر كاملة أبدًا.</p>
    {!form && <Button onClick={() => setForm(empty)}><Plus />إضافة مفتاح</Button>}
    {form && <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <h4 className="text-sm">{form.id ? "تعديل المفتاح" : "مفتاح جديد"}</h4>
      <input aria-label="اسم المفتاح" placeholder="اسم وصفي (اختياري)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="rounded-lg border border-border bg-background p-2" />
      <select aria-label="مزوّد الخدمة" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value, model: PROVIDERS.find((p) => p.id === e.target.value)?.model ?? "" })} className="rounded-lg border border-border bg-background p-2">
        {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <input aria-label="الموديل" dir="ltr" placeholder="اسم الموديل" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="rounded-lg border border-border bg-background p-2" />
      <input aria-label="مفتاح API" dir="ltr" type="password" autoComplete="off" placeholder={form.id ? "اتركه فارغًا للإبقاء على المفتاح الحالي" : "مفتاح API"} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="rounded-lg border border-border bg-background p-2" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />مفعّل</label>
      <div className="flex gap-2">
        <Button disabled={busy === "form"} onClick={() => void run("form", async () => { await save({ data: form }); setForm(null); }, "تم حفظ المفتاح")}>{busy === "form" && <Loader2 className="animate-spin" />}حفظ</Button>
        <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
      </div>
    </section>}
    {!keys.data?.length && <p className="text-sm text-muted-foreground">لا توجد مفاتيح بعد؛ يستخدم التطبيق الخدمة المدمجة حاليًا.</p>}
    {keys.data?.map((k, i) => <section key={k.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1 text-sm">{enabledIds[0] === k.id && <Star className="size-4 text-primary" />}{k.label || PROVIDERS.find((p) => p.id === k.provider)?.label}</h4>
        <span className="text-xs text-muted-foreground">{!k.enabled ? "معطّل" : enabledIds[0] === k.id ? "أساسي" : `احتياطي ${enabledIds.indexOf(k.id)}`}</span>
      </div>
      <p className="text-xs" dir="ltr">{k.provider} · {k.model} · {k.masked}</p>
      <p className="text-xs text-muted-foreground">الحالة: {k.last_status === "ok" ? "يعمل ✅" : k.last_status ?? "لم يُختبر"} · آخر استخدام: {k.last_used_at ? new Date(k.last_used_at).toLocaleString("ar") : "—"}</p>
      {k.last_error && <p className="break-all text-xs text-destructive" dir="ltr">{k.last_error}</p>}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run(k.id, async () => { const r = await test({ data: { id: k.id } }); r.ok ? toast.success(`الاتصال ناجح (${r.ms} ms)`) : toast.error(`فشل الاتصال: ${r.status}`); })}>{busy === k.id ? <Loader2 className="animate-spin" /> : <Plug />}اختبار</Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run(k.id, () => save({ data: { id: k.id, label: k.label, provider: k.provider, model: k.model, enabled: !k.enabled } }), k.enabled ? "تم التعطيل" : "تم التفعيل")}>{k.enabled ? "تعطيل" : "تفعيل"}</Button>
        <Button size="sm" variant="outline" disabled={!!busy || i === 0} onClick={() => { const n = [k.id, ...ids.filter((x) => x !== k.id)]; void run("order", () => reorder({ data: { ids: n } }), "أصبح المفتاح أساسيًا"); }}><Star />أساسي</Button>
        <Button size="icon" variant="ghost" aria-label="أعلى" disabled={!!busy || i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
        <Button size="icon" variant="ghost" aria-label="أسفل" disabled={!!busy || i === ids.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
        <Button size="icon" variant="ghost" aria-label="تعديل" onClick={() => setForm({ id: k.id, label: k.label, provider: k.provider, model: k.model, apiKey: "", enabled: k.enabled })}><Pencil /></Button>
        <Button size="icon" variant="ghost" aria-label="حذف" disabled={!!busy} onClick={() => { if (window.confirm("حذف هذا المفتاح نهائيًا؟")) void run(k.id, () => del({ data: { id: k.id } }), "تم الحذف"); }}><Trash2 /></Button>
      </div>
    </section>)}
  </div>;
}
