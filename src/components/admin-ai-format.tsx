import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatLessonExplanation, formatLessonSummary } from "@/lib/format.functions";
import { loadSubjectLessons, type SubjectLesson } from "@/lib/subject-content";
import { explanationHtml, looksLikeHtml, sanitizeHtml } from "@/lib/sanitize-html";
import { groupBlocks, partComplete, wordCount } from "@/lib/format-chunks";
import { AdminContentPicker } from "@/components/admin-content-picker";
import { Button } from "@/components/ui/button";

export function AdminAiFormat() {
  return <AdminContentPicker>{(s) => s[2] ? <Formatter key={s[2].id} subjectId={s[2].id} subject={s[2].name ?? ""} /> : null}</AdminContentPicker>;
}

type Part = { src: string; html: string; error: string };
type Result = { lesson: SubjectLesson; original: string; parts: Part[]; html: string; ratio: number; status: "ready" | "failed" | "saved" | "rejected" | "restored"; error: string };
const words = wordCount;
/** Split saved content into ordered top-level blocks (paragraphs, headings, lists, tables). */
function blocksOf(text: string): string[] {
  if (!looksLikeHtml(text)) return text.split(/\n(?=\s*\S)/);
  const doc = new DOMParser().parseFromString(`<body>${text}</body>`, "text/html");
  return [...doc.body.childNodes].map((n) => n.nodeType === 1 ? (n as Element).outerHTML : (n.textContent ?? "")).filter((x) => x.trim());
}

function Formatter({ subjectId, subject }: { subjectId: string; subject: string }) {
  const formatExplain = useServerFn(formatLessonExplanation);
  const formatSummary = useServerFn(formatLessonSummary);
  const [kind, setKind] = useState<"explanation" | "summary">("explanation");
  const src = (l: SubjectLesson) => kind === "summary" ? l.summary : l.explanation;
  const minRatio = kind === "summary" ? 0.85 : 0.9;
  const cache = useQueryClient();
  const [scope, setScope] = useState<"lesson" | "unit" | "subject">("lesson");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const lessons = useQuery({ queryKey: ["format-lessons", subjectId], queryFn: () => loadSubjectLessons(subjectId, false) });
  const units = [...new Map((lessons.data ?? []).map((l) => [l.unitId, l.unitTitle])).entries()];

  /** Format every missing part of one lesson in order; each part gets up to 3 attempts (each attempt already tries all backup keys). */
  const processLesson = async (r: Result, label: string): Promise<Result> => {
    const parts = r.parts.map((p) => ({ ...p }));
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k]!;
      if (part.html) continue;
      for (let attempt = 1; attempt <= 3 && !part.html; attempt++) {
        setProgress(`${label} · الجزء ${k + 1} من ${parts.length}${attempt > 1 ? ` · محاولة ${attempt}` : ""}`);
        try {
          const res = await (kind === "summary" ? formatSummary : formatExplain)({ data: { title: r.lesson.title, text: part.src, part: k + 1, parts: parts.length } });
          const html = res.ok ? sanitizeHtml(res.html) : "";
          if (html && partComplete(part.src, html, minRatio)) { part.html = html; part.error = ""; }
          else part.error = res.ok ? `النتيجة ناقصة (احتفظت بـ ${Math.round(words(html) / Math.max(1, words(part.src)) * 100)}٪ من الكلمات أو حذفت نقاطًا)` : res.error;
        } catch (e) { part.error = e instanceof Error ? e.message : "خطأ في الاتصال"; }
      }
      if (!part.html) {
        return { ...r, parts, status: "failed", error: `تعطل الجزء ${k + 1} من ${parts.length}: ${part.error}` };
      }
    }
    const html = parts.map((p) => p.html).join("\n");
    return { ...r, parts, html, ratio: words(html) / Math.max(1, words(r.original)), status: "ready", error: "" };
  };

  const run = async () => {
    const all = (lessons.data ?? []).filter((l) => src(l).trim());
    const targets = scope === "subject" ? all : scope === "unit" ? all.filter((l) => l.unitId === unitId) : all.filter((l) => l.id === lessonId);
    if (!targets.length) { toast.error(kind === "summary" ? "اختر درسًا أو وحدة تحتوي على ملخص" : "اختر درسًا أو وحدة تحتوي على شرح"); return; }
    setBusy(true);
    const out: Result[] = targets.map((lesson) => ({ lesson, original: src(lesson), parts: groupBlocks(blocksOf(src(lesson))).map((t) => ({ src: t, html: "", error: "" })), html: "", ratio: 0, status: "failed", error: "لم يبدأ بعد" }));
    setResults([...out]);
    for (let i = 0; i < out.length; i++) { out[i] = await processLesson(out[i]!, `الدرس ${i + 1} من ${out.length}: ${out[i]!.lesson.title}`); setResults([...out]); }
    setBusy(false); setProgress("");
    const failed = out.filter((r) => r.status === "failed").length;
    if (failed) toast.error(`لم يكتمل ${failed} درسًا؛ يمكنك الاستكمال من الجزء المتعطل`); else toast.success("اكتمل تنسيق جميع الأجزاء؛ لم يُحفظ شيء بعد");
  };
  const resume = async () => {
    setBusy(true);
    const out = [...results];
    for (let i = 0; i < out.length; i++) if (out[i]!.status === "failed") { out[i] = await processLesson(out[i]!, `استكمال ${out[i]!.lesson.title}`); setResults([...out]); }
    setBusy(false); setProgress("");
  };

  const save = async (lessonIdToSave: string, value: string) => {
    const { error } = kind === "summary"
      ? await supabase.rpc("admin_save_lesson_summary", { _lesson_id: lessonIdToSave, _summary: value })
      : await supabase.rpc("admin_save_lesson_explanation", { _lesson_id: lessonIdToSave, _explanation: value });
    if (error) throw new Error(error.message);
    const { data, error: readError } = await supabase.from("lesson_content").select("explanation,summary").eq("lesson_id", lessonIdToSave).single();
    if (readError || (kind === "summary" ? data.summary : data.explanation) !== value) throw new Error("لم يُتحقق من الحفظ في قاعدة البيانات");
    await Promise.all([["lesson", lessonIdToSave], ["admin-explanation", lessonIdToSave], ["format-lessons", subjectId], ["explanation-revisions", lessonIdToSave]].map((queryKey) => cache.invalidateQueries({ queryKey })));
  };
  const approve = async (i: number) => {
    const r = results[i]; if (!r || r.status !== "ready" || r.parts.some((p) => !p.html)) return;
    try { await save(r.lesson.id, r.html); setResults((old) => old.map((x, j) => j === i ? { ...x, status: "saved" } : x)); }
    catch (e) { toast.error(`تعذر الحفظ: ${e instanceof Error ? e.message : ""}`); }
  };
  const undo = async (i: number) => {
    const r = results[i]; if (!r) return;
    try { await save(r.lesson.id, r.original); setResults((old) => old.map((x, j) => j === i ? { ...x, status: "restored" } : x)); toast.success("أُعيد المحتوى الأصلي"); }
    catch (e) { toast.error(`تعذر الاسترجاع: ${e instanceof Error ? e.message : ""}`); }
  };
  const approveAll = async () => {
    setBusy(true);
    for (let i = 0; i < results.length; i++) if (results[i]?.status === "ready") await approve(i);
    setBusy(false); toast.success("تم اعتماد النتائج المكتملة؛ الأصل محفوظ في النسخ السابقة");
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
    {results.some((r) => r.status === "ready") && !busy && <Button variant="outline" onClick={() => void approveAll()}><Check />اعتماد كل النتائج المكتملة</Button>}
    {results.some((r) => r.status === "failed") && !busy && <Button variant="outline" onClick={() => void resume()}><RotateCcw />استكمال الأجزاء المتعطلة</Button>}
    {results.map((r, i) => <section key={r.lesson.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm">{r.lesson.unitTitle} · {r.lesson.title}</h4>
        <span className="text-xs text-muted-foreground">{r.status === "saved" ? "تم الاعتماد والتحقق من الحفظ" : r.status === "restored" ? "أُعيد الأصل" : r.status === "rejected" ? "مرفوض" : r.status === "failed" ? `اكتمل ${r.parts.filter((p) => p.html).length} من ${r.parts.length} أجزاء` : `${r.parts.length} أجزاء · حجم المحتوى ${Math.round(r.ratio * 100)}٪`}</span>
      </div>
      {r.status === "failed" && <p className="text-xs text-destructive">{r.error}. لم يتغير المحتوى الأصلي.</p>}
      {r.status === "saved" && <Button size="sm" variant="outline" onClick={() => void undo(i)}><RotateCcw />التراجع واسترجاع الأصل</Button>}
      {r.html && r.status !== "failed" && <details><summary className="cursor-pointer text-xs text-muted-foreground">{kind === "summary" ? "الملخص الأصلي" : "الشرح الأصلي"}</summary><div className="lesson-rich text-sm opacity-80" dangerouslySetInnerHTML={{ __html: explanationHtml(src(r.lesson)) }} /></details>}
      {r.html && r.status !== "failed" && <div className="lesson-rich rounded-xl bg-card p-3" dir="rtl" dangerouslySetInnerHTML={{ __html: r.html }} />}
      {r.status === "ready" && <div className="flex gap-2">
        <Button size="sm" onClick={() => void approve(i)}><Check />اعتماد</Button>
        <Button size="sm" variant="outline" onClick={() => setResults((o) => o.map((x, j) => j === i ? { ...x, status: "rejected" } : x))}><X />رفض</Button>
      </div>}
    </section>)}
    {kind === "summary" ? <p className="text-xs text-muted-foreground">عند الرفض لا يتغير الملخص. عند الاعتماد يُحفظ الملخص الأصلي في النسخ السابقة، ويمكنك التراجع مباشرة.</p> : <p className="text-xs text-muted-foreground">عند الاعتماد يُحفظ الشرح الأصلي تلقائيًا في «النسخ السابقة» داخل صفحة «تعديل شرح الدروس» ويمكن استرجاعه.</p>}
  </div>;
}
