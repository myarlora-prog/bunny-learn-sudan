import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save, Upload, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useApp } from "@/lib/app-state";
import { generateExamChunk, type ExamQuestion } from "@/lib/exam.functions";
import { splitExamSource, validExamQuestions } from "@/lib/exam-utils";
import { extractText } from "@/lib/pdf-text";
import { loadSubjectLessons, lessonSource, autoQuestionCount } from "@/lib/subject-content";
import { AdminContentPicker } from "@/components/admin-content-picker";
import { Button } from "@/components/ui/button";

export function AdminSubjectExams() {
  return <AdminContentPicker>{(s) => s[2] ? <ExamBuilder key={s[2].id} subjectId={s[2].id} subject={s[2].name ?? ""} /> : null}</AdminContentPicker>;
}
function ExamBuilder({ subjectId, subject }: { subjectId: string; subject: string }) {
  const { session } = useApp();
  const cache = useQueryClient();
  const generate = useServerFn(generateExamChunk);
  const storageKey = `nawabig-exam:${session?.user.id}:${subjectId}`;
  const [id, setId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [title, setTitle] = useState(`اختبار ${subject}`);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"saved" | "text">("saved");
  const [manualCount, setManualCount] = useState("");
  const exams = useQuery({ queryKey: ["admin-exams", subjectId], queryFn: async () => {
    const { data, error } = await supabase.from("subject_exams").select("*").eq("subject_id", subjectId).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  }});
  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) {
      const draft = JSON.parse(saved); setId(draft.id ?? null); setSource(draft.source ?? ""); setTitle(draft.title ?? title); setQuestions(draft.questions ?? []);
    }} catch { /* retain current text */ }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify({ id, source, title, questions })); }, [loaded, storageKey, id, source, title, questions]);
  const create = async (replaceIndex?: number) => {
    if (mode === "text" && source.trim().length < 20) { toast.error("أضف نصًا واضحًا وكافيًا لإنشاء الأسئلة"); return; }
    if (replaceIndex === undefined && questions.length && !window.confirm("إعادة إنشاء الأسئلة الحالية؟ النسخة المحفوظة لن تتغير.")) return;
    setBusy(true); setIssues([]);
    try {
      let chunks: string[];
      if (mode === "saved") {
        setProgress("جلب محتوى المادة المنشور من قاعدة البيانات…");
        const lessons = (await loadSubjectLessons(subjectId, true)).map(lessonSource).filter((t) => t.length > 60);
        if (!lessons.length) throw new Error("لا يوجد محتوى منشور محفوظ لهذه المادة بعد");
        chunks = [];
        for (const t of lessons) {
          const last = chunks.length - 1;
          if (last >= 0 && chunks[last]!.length + t.length < 14000) chunks[last] += `\n\n${t}`;
          else chunks.push(...splitExamSource(t, 14000));
        }
        setSource(chunks.join("\n\n"));
      } else chunks = splitExamSource(source);
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const wanted = Number(manualCount) > 0 ? Number(manualCount) : 0;
      const countFor = (c: string) => wanted ? Math.max(1, Math.round((wanted * c.length) / total)) : autoQuestionCount(c.length);
      const generated: ExamQuestion[] = [];
      const warnings: string[] = [];
      for (let part = 0; part < chunks.length; part++) {
        setProgress(`معالجة الجزء ${part + 1} من ${chunks.length} · ${generated.length} سؤالًا حتى الآن`);
        const result = await generate({ data: { subject, chunk: chunks[part] ?? "", count: replaceIndex === undefined ? countFor(chunks[part] ?? "") : 1, part: part + 1, parts: chunks.length, avoid: [...questions, ...generated].map((q) => q.q) } });
        warnings.push(...result.issues);
        if (!result.ok) { if (generated.length) { warnings.push(`توقف عند الجزء ${part + 1}`); break; } throw new Error(result.issues.join(" · ")); }
        for (const q of result.questions) if (!generated.some((x) => x.q.trim() === q.q.trim())) generated.push(q);
      }
      setIssues(warnings);
      if (replaceIndex !== undefined) {
        const first = generated[0]; if (!first) throw new Error("لم يُنشأ سؤال مناسب");
        setQuestions((old) => old.map((q, i) => i === replaceIndex ? first : q));
      } else setQuestions(wanted ? generated.slice(0, wanted) : generated);
      toast.success("الأسئلة جاهزة للمراجعة؛ لم يتم النشر");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إنشاء الأسئلة؛ النص محفوظ على جهازك"); }
    finally { setBusy(false); setProgress(""); }
  };
  const save = async (status: "draft" | "published") => {
    if (!title.trim() || (status === "published" && !validExamQuestions(questions))) { toast.error("أكمل العنوان والأسئلة والخيارات والإجابات قبل النشر"); return; }
    setBusy(true);
    const nextId = id ?? crypto.randomUUID();
    setId(nextId);
    try {
      const { error } = await supabase.from("subject_exams").upsert({ id: nextId, subject_id: subjectId, title, source_text: source, questions: questions as unknown as Json, status, created_by: session?.user.id ?? null, published_at: status === "published" ? new Date().toISOString() : null });
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["admin-exams", subjectId] });
      await cache.invalidateQueries({ queryKey: ["published-exams", subjectId] });
      localStorage.removeItem(storageKey); toast.success(status === "published" ? "تم نشر الاختبار للطلاب" : "تم حفظ المسودة");
    } catch { toast.error("تعذر الحفظ؛ المحتوى محفوظ على جهازك، حاول مجددًا"); }
    finally { setBusy(false); }
  };
  const update = (i: number, patch: Partial<ExamQuestion>) => setQuestions((old) => old.map((q, j) => j === i ? { ...q, ...patch } : q));
  return <div className="flex flex-col gap-4">
    <h3>{subject}</h3>
    <div className="flex gap-2"><select aria-label="الاختبارات المحفوظة" value={id ?? ""} disabled={busy} className="min-w-0 flex-1 rounded-lg border border-border bg-card p-2" onChange={(e) => {
      const exam = exams.data?.find((x) => x.id === e.target.value); if (!exam) return;
      if (!window.confirm("فتح الاختبار المحفوظ بدل التعديل الحالي؟")) return;
      setId(exam.id); setTitle(exam.title); setSource(exam.source_text); setQuestions(exam.questions as unknown as ExamQuestion[]);
    }}><option value="">اختر اختبارًا محفوظًا</option>{exams.data?.map((e) => <option key={e.id} value={e.id}>{e.title} · {e.status === "published" ? "منشور" : "مسودة"}</option>)}</select>
    <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("بدء اختبار جديد؟")) { setId(null); setQuestions([]); setSource(""); setTitle(`اختبار ${subject}`); } }}><Plus />جديد</Button></div>
    <input aria-label="عنوان الاختبار" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-border bg-card p-3" />
    <div className="flex gap-2">
      <Button variant={mode === "saved" ? "default" : "outline"} onClick={() => setMode("saved")}>محتوى المادة المحفوظ</Button>
      <Button variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}>نص أو ملف</Button>
    </div>
    {mode === "saved" ? <p className="text-sm text-muted-foreground">سيُستخدم شرح وملخصات وبطاقات جميع الدروس المنشورة لهذه المادة فقط، دون الحاجة لإدخال نص.</p> : <>
    <textarea aria-label="مصدر أسئلة الاختبار" value={source} onChange={(e) => setSource(e.target.value)} className="min-h-72 rounded-lg border border-border bg-card p-3 text-sm leading-loose" placeholder="نص المادة" />
    <label className="flex items-center gap-2 text-sm"><Upload className="size-4" />PDF / TXT<input type="file" accept=".pdf,.txt" disabled={busy} className="min-w-0 flex-1 text-xs" onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return; setBusy(true);
      try { const text = await extractText(file); if (!text.trim()) throw new Error(); setSource((s) => s ? `${s}\n\n${text}` : text); } catch { toast.error("تعذر قراءة النص من الملف؛ استخدم ملفًا نصيًا أو PDF يحتوي على نص"); } finally { setBusy(false); }
    }} /></label>
    </>}
    <input aria-label="عدد الأسئلة" inputMode="numeric" value={manualCount} onChange={(e) => setManualCount(e.target.value.replace(/\D/g, ""))} placeholder="عدد الأسئلة (اتركه فارغًا لأكبر عدد مناسب تلقائيًا)" className="rounded-lg border border-border bg-card p-3 text-sm" />
    <Button disabled={busy} onClick={() => void create()}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}إنشاء الاختبار بالذكاء الاصطناعي</Button>
    {progress && <p role="status" className="text-primary">{progress}</p>}
    {issues.map((issue, i) => <p key={i} className="text-sm text-destructive">{issue}</p>)}
    {questions.map((q, i) => <section key={i} className="flex flex-col gap-2 border-b border-border py-4">
      <div className="flex items-center justify-between"><h4>السؤال {i + 1}</h4><div className="flex gap-1"><Button title="إعادة توليد السؤال" aria-label={`إعادة توليد السؤال ${i + 1}`} size="icon" variant="ghost" disabled={busy} onClick={() => void create(i)}><RefreshCw /></Button><Button title="حذف السؤال" aria-label={`حذف السؤال ${i + 1}`} size="icon" variant="ghost" disabled={busy} onClick={() => setQuestions((old) => old.filter((_, j) => j !== i))}><Trash2 /></Button></div></div>
      <textarea aria-label={`نص السؤال ${i + 1}`} value={q.q} onChange={(e) => update(i, { q: e.target.value })} className="rounded-lg border border-border bg-card p-3" />
      {q.options.map((o, k) => <label key={k} className="flex items-center gap-2"><input type="radio" name={`correct-${i}`} aria-label={`الإجابة الصحيحة للسؤال ${i + 1} الخيار ${k + 1}`} checked={q.correct === k} onChange={() => update(i, { correct: k })} /><input aria-label={`السؤال ${i + 1} الخيار ${k + 1}`} className="min-w-0 flex-1 rounded-lg border border-border bg-card p-2" value={o} onChange={(e) => update(i, { options: q.options.map((x, j) => j === k ? e.target.value : x) })} /></label>)}
      <textarea aria-label={`تفسير السؤال ${i + 1}`} value={q.hint} onChange={(e) => update(i, { hint: e.target.value })} className="rounded-lg border border-border bg-card p-2" />
    </section>)}
    <Button variant="outline" disabled={busy} onClick={() => setQuestions((old) => [...old, { q: "", options: ["", "", "", ""], correct: 0, hint: "" }])}><Plus />إضافة سؤال</Button>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void save("draft")}><Save />حفظ كمسودة</Button><Button disabled={busy} onClick={() => void save("published")}>نشر الاختبار</Button></div>
  </div>;
}