import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchTourSteps, type TourStep } from "@/lib/tour-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

async function saveStep(id: string, patch: Partial<Pick<TourStep, "title" | "body" | "enabled" | "sort_order">>) {
  const { data, error } = await supabase.from("tour_steps").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("لا تملك صلاحية تعديل الجولة");
}

export function AdminTour() {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", enabled: true });
  const [busy, setBusy] = useState(false);

  const load = () => fetchTourSteps().then(setSteps).catch((e: Error) => toast.error(e.message));
  useEffect(() => { void load(); }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const move = (i: number, d: -1 | 1) => {
    if (!steps) return;
    const a = steps[i]!, b = steps[i + d];
    if (!b) return;
    void run(async () => {
      await saveStep(a.id, { sort_order: b.sort_order });
      await saveStep(b.id, { sort_order: a.sort_order });
    }, "تم حفظ الترتيب");
  };

  const restoreAll = () => {
    if (!steps || !window.confirm("استعادة نصوص جميع الخطوات إلى النصوص الأصلية؟ لن يتغير الترتيب أو التفعيل.")) return;
    void run(async () => {
      for (const s of steps) await saveStep(s.id, { title: s.default_title, body: s.default_body });
    }, "تمت استعادة جميع النصوص");
  };

  if (!steps) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" disabled={busy} onClick={restoreAll} className="rounded-2xl">
        <RotateCcw className="size-4" /> استعادة جميع النصوص الأصلية
      </Button>
      {steps.map((s, i) => (
        <div key={s.id} className={cn("surface-card p-4", !s.enabled && "opacity-60")}>
          <div className="flex items-start gap-3">
            <span className="gradient-hero flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{s.title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{s.body}</p>
              <p className="mt-1 text-[11px] text-primary">{s.page_label} · {s.enabled ? "مفعّلة" : "متوقفة"}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon" variant="ghost" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="تحريك لأعلى"><ArrowUp className="size-4" /></Button>
              <Button size="icon" variant="ghost" disabled={busy || i === steps.length - 1} onClick={() => move(i, 1)} aria-label="تحريك لأسفل"><ArrowDown className="size-4" /></Button>
            </div>
          </div>
          {editing === s.id ? (
            <div className="mt-3 flex flex-col gap-2">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="عنوان الخطوة" />
              <Textarea value={draft.body} rows={4} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="نص الخطوة" />
              <label className="flex items-center justify-between text-sm font-bold">مفعّلة <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} /></label>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-2xl" disabled={busy || !draft.title.trim() || !draft.body.trim()} onClick={() => void run(async () => { await saveStep(s.id, { title: draft.title.trim(), body: draft.body.trim(), enabled: draft.enabled }); setEditing(null); }, "تم حفظ التعديلات")}>حفظ التعديلات</Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => setEditing(null)}>إلغاء</Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setEditing(s.id); setDraft({ title: s.title, body: s.body, enabled: s.enabled }); }}><Pencil className="size-3.5" /> تعديل</Button>
              <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => void run(() => saveStep(s.id, { enabled: !s.enabled }), s.enabled ? "تم إيقاف الخطوة" : "تم تفعيل الخطوة")}>{s.enabled ? "إيقاف" : "تفعيل"}</Button>
              <Button size="sm" variant="ghost" className="rounded-xl" disabled={busy} onClick={() => { if (window.confirm("استعادة النص الأصلي لهذه الخطوة؟")) void run(() => saveStep(s.id, { title: s.default_title, body: s.default_body }), "تمت استعادة النص الأصلي"); }}><RotateCcw className="size-3.5" /> استعادة النص الأصلي</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
