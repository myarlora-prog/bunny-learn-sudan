import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatLessonExplanation, formatLessonSummary } from "@/lib/format.functions";
import { loadSubjectLessons, plainText, type SubjectLesson } from "@/lib/subject-content";
import { explanationHtml, sanitizeHtml } from "@/lib/sanitize-html";
import { AdminContentPicker } from "@/components/admin-content-picker";
import { Button } from "@/components/ui/button";

export function AdminAiFormat() {
  return <AdminContentPicker>{(s) => s[2] ? <Formatter key={s[2].id} subjectId={s[2].id} subject={s[2].name ?? ""} /> : null}</AdminContentPicker>;
}

type Result = { lesson: SubjectLesson; html: string; ratio: number; status: "ready" | "failed" | "saved" | "rejected" };
const words = (s: string) => plainText(s.replace(/<\/(p|h\d|li|div)>/gi, " ")).split(/\s+/).filter(Boolean).length;

function Formatter({ subjectId, subject }: { subjectId: string; subject: string }) {
  const formatExplain = useServerFn(formatLessonExplanation);
  const formatSummary = useServerFn(formatLessonSummary);
  const [kind, setKind] = useState<"explanation" | "summary">("explanation");
  const src = (l: SubjectLesson) => kind === "summary" ? l.summary : l.explanation;
  const cache = useQueryClient();
  const [scope, setScope] = useState<"lesson" | "unit" | "subject">("lesson");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const lessons = useQuery({ queryKey: ["format-lessons", subjectId], queryFn: () => loadSubjectLessons(subjectId, false) });
  const units = [...new Map((lessons.data ?? []).map((l) => [l.unitId, l.unitTitle])).entries()];

  const run = async () => {
    const all = (lessons.data ?? []).filter((l) => src(l).trim());
    const targets = scope === "subject" ? all : scope === "unit" ? all.filter((l) => l.unitId === unitId) : all.filter((l) => l.id === lessonId);
    if (!targets.length) { toast.error(kind === "summary" ? "اختر درسًا أو وحدة تحتوي على ملخص" : "اختر درسًا أو وحدة تحتوي على شرح"); return; }
    setBusy(true); setResults([]);
    const out: Result[] = [];
    for (let i = 0; i < targets.length; i++) {
      const lesson = targets[i]!;
      setProgress(`تنسيق الدرس ${i + 1} من ${targets.length}: ${lesson.title}`);
      try {
        const r = await (kind === "summary" ? formatSummary : formatExplain)({ data: { title: lesson.title, text: src(lesson) } });
        const html = r.ok ? sanitizeHtml(r.html) : "";
        out.push({ lesson, html, ratio: html ? words(html) / Math.max(1, words(src(lesson))) : 0, status: html ? "ready" : "failed" });
      } catch { out.push({ lesson, html: "", ratio: 0, status: "failed" }); }
      setResults([...out]);
    }
    setBusy(false); setProgress("");
    toast.success("النتائج جاهزة للمراجعة؛ لم يُحفظ شيء بعد");
  };

  const approve = async (i: number) => {
    const r = results[i]; if (!r) return;
    const { error } = kind === "summary"
      ? await supabase.rpc("admin_save_lesson_summary", { _lesson_id: r.lesson.id, _summary: r.html })
      : await supabase.rpc("admin_save_lesson_explanation", { _lesson_id: r.lesson.id, _explanation: r.html });
    if (error) { toast.error("تعذر الحفظ، حاول مجددًا"); return; }
    setResults((old) => old.map((x, j) => j === i ? { ...x, status: "saved" } : x));
    await cache.invalidateQueries({ queryKey: ["lesson", r.lesson.id] });
    await cache.invalidateQueries({ queryKey: ["admin-explanation", r.lesson.id] });
    await cache.invalidateQueries({ queryKey: ["format-lessons", subjectId] });
    await cache.invalidateQueries({ queryKey: ["explanation-revisions", r.lesson.id] });
  };
  const approveAll = async () => {
    setBusy(true);
    for (let i = 0; i < results.length; i++) if (results[i]?.status === "ready" && results[i]!.ratio >= (kind === "summary" ? 0.85 : 0.9)) await approve(i);
    setBusy(false); toast.success("تم اعتماد النتائج السليمة؛ الأصل محفوظ في النسخ السابقة");
  };

  if (lessons.isLoading) return <Loader2 className="mx-auto animate-spin text-primary" />;
  if (lessons.isError) return <p className="text-destructive">تعذر تحميل دروس المادة</p>;
  return <div className="flex flex-col gap-3">
    <h3>{subject}</h3>
    <div className="flex flex-wrap gap-2">
      <Button variant={kind === "explanation" ? "default" : "outline"} disabled={busy} onClick={() => { setKind("explanation"); setResults([]); }}>تنسيق الشرح</Button>
      <Button variant={kind === "summary" ? "default" : "outline"} disabled={busy} onClick={() => { setKind("summary"); setResults([]); }}>تنسيق الملخص</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      {([["lesson", "درس واحد"], ["unit", "وحدة كاملة"], ["subject", "المادة كاملة"]] as const).map(([v, l]) =>
        <Button key={v} variant={scope === v ? "default" : "outline"} disabled={busy} onClick={() => setScope(v)}>{l}</Button>)}
    </div>
    {scope !== "subject" && <select aria-label="الوحدة" value={unitId} disabled={busy} onChange={(e) => { setUnitId(e.target.value); setLessonId(""); }} className="rounded-lg border border-border bg-card p-2">
      <option value="">اختر الوحدة</option>{units.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
    </select>}
    {scope === "lesson" && unitId && <select aria-label="الدرس" value={lessonId} disabled={busy} onChange={(e) => setLessonId(e.target.value)} className="rounded-lg border border-border bg-card p-2">
      <option value="">اختر الدرس</option>{lessons.data?.filter((l) => l.unitId === unitId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
    </select>}
    <Button disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}تنسيق بالذكاء الاصطناعي</Button>
    {progress && <p role="status" className="text-primary">{progress}</p>}
    {results.some((r) => r.status === "ready") && !busy && <Button variant="outline" onClick={() => void approveAll()}><Check />اعتماد كل النتائج السليمة</Button>}
    {results.map((r, i) => <section key={r.lesson.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm">{r.lesson.unitTitle} · {r.lesson.title}</h4>
        <span className="text-xs text-muted-foreground">{r.status === "saved" ? "تم الاعتماد" : r.status === "rejected" ? "مرفوض" : r.status === "failed" ? "فشل التنسيق" : `حجم المحتوى ${Math.round(r.ratio * 100)}٪`}</span>
      </div>
      {r.status === "ready" && r.ratio < (kind === "summary" ? 0.85 : 0.9) && <p className="text-xs text-destructive">تحذير: النتيجة أقصر من الأصل وقد تكون حذفت معلومات؛ راجعها قبل الاعتماد.</p>}
      {r.html && <details><summary className="cursor-pointer text-xs text-muted-foreground">{kind === "summary" ? "الملخص الأصلي" : "الشرح الأصلي"}</summary><div className="lesson-rich text-sm opacity-80" dangerouslySetInnerHTML={{ __html: explanationHtml(src(r.lesson)) }} /></details>}
      {r.html && <div className="lesson-rich rounded-xl bg-card p-3" dir="rtl" dangerouslySetInnerHTML={{ __html: r.html }} />}
      {r.status === "ready" && <div className="flex gap-2">
        <Button size="sm" onClick={() => void approve(i)}><Check />اعتماد</Button>
        <Button size="sm" variant="outline" onClick={() => setResults((o) => o.map((x, j) => j === i ? { ...x, status: "rejected" } : x))}><X />رفض</Button>
      </div>}
    </section>)}
    {kind === "summary" ? <p className="text-xs text-muted-foreground">عند الإلغاء لا يتغير الملخص، وعند الاعتماد يُحفظ في ملخص الدرس نفسه ويظهر للطالب.</p> : <p className="text-xs text-muted-foreground">عند الاعتماد يُحفظ الشرح الأصلي تلقائيًا في «النسخ السابقة» داخل صفحة «تعديل شرح الدروس» ويمكن استرجاعه.</p>}
  </div>;
}
