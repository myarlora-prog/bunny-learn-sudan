import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import type { ExamQuestion } from "@/lib/exam.functions";
import { validExamQuestions } from "@/lib/exam-utils";
import type { Json } from "@/integrations/supabase/types";

type ExamRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  subject_id: string;
  unit_id: string | null;
  questions: Json;
  subjectName: string;
  gradeName: string;
  stageName: string;
  unitName: string | null;
};

export function AdminExamManager() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ExamRow | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const exams = useQuery({
    queryKey: ["admin", "exam-manager"],
    enabled: isAdmin,
    queryFn: async (): Promise<ExamRow[]> => {
      const [examResult, subjectResult, gradeResult, stageResult, unitResult] = await Promise.all([
        supabase.from("subject_exams").select("id,title,status,created_at,subject_id,unit_id,questions").order("created_at", { ascending: false }),
        supabase.from("subjects").select("id,name,grade_id"),
        supabase.from("grades").select("id,name,stage_id"),
        supabase.from("stages").select("id,name"),
        supabase.from("units").select("id,title"),
      ]);
      for (const result of [examResult, subjectResult, gradeResult, stageResult, unitResult]) if (result.error) throw result.error;
      const subjects = new Map((subjectResult.data ?? []).map((row) => [row.id, row]));
      const grades = new Map((gradeResult.data ?? []).map((row) => [row.id, row]));
      const stages = new Map((stageResult.data ?? []).map((row) => [row.id, row]));
      const units = new Map((unitResult.data ?? []).map((row) => [row.id, row]));
      return (examResult.data ?? []).map((exam) => {
        const subject = subjects.get(exam.subject_id);
        const grade = subject ? grades.get(subject.grade_id) : undefined;
        const stage = grade ? stages.get(grade.stage_id) : undefined;
        return { ...exam, subjectName: subject?.name ?? "مادة غير معروفة", gradeName: grade?.name ?? "صف غير معروف", stageName: stage?.name ?? "مرحلة غير معروفة", unitName: exam.unit_id ? units.get(exam.unit_id)?.title ?? "وحدة" : null };
      });
    },
  });

  const openExam = (exam: ExamRow) => {
    setSelected(exam);
    setTitle(exam.title);
    setStatus(exam.status);
    setQuestions(JSON.parse(JSON.stringify(exam.questions)) as ExamQuestion[]);
  };
  const update = (index: number, patch: Partial<ExamQuestion>) => setQuestions((old) => old.map((question, i) => i === index ? { ...question, ...patch } : question));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "exam-manager"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
    await queryClient.invalidateQueries({ queryKey: ["published-exams"] });
  };
  const save = async () => {
    if (!selected || !validExamQuestions(questions) || !title.trim()) {
      toast.error("أكمل العنوان ونصوص الأسئلة والخيارات والإجابات الصحيحة");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_subject_exam", { _id: selected.id, _title: title, _questions: questions as unknown as Json, _status: status });
    setBusy(false);
    if (error) { toast.error("تعذّر حفظ الاختبار؛ لم تتغير النسخة المحفوظة"); return; }
    setSelected(null);
    await refresh();
    toast.success("تم حفظ تعديلات الاختبار");
  };
  const remove = async (exam: ExamRow) => {
    if (!window.confirm(`حذف «${exam.title}» فقط؟ لن تُحذف نتائج الطلاب أو الدروس أو المواد.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_subject_exam", { _id: exam.id });
    setBusy(false);
    if (error) { toast.error("تعذّر حذف الاختبار"); return; }
    if (selected?.id === exam.id) setSelected(null);
    await refresh();
    toast.success("حُذف الاختبار المحدد فقط");
  };

  if (exams.isLoading) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  if (exams.isError) return <p className="text-sm text-destructive">تعذّر تحميل الاختبارات.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">جميع اختبارات المواد والوحدات. الحذف يخص الاختبار المحدد فقط ولا يمس نتائج الطلاب أو المنهج.</p>
      {!exams.data?.length && <Card className="text-center text-sm text-muted-foreground">لا توجد اختبارات محفوظة.</Card>}
      {exams.data?.map((exam) => (
        <Card key={exam.id} className="flex items-start gap-3">
          <button type="button" className="min-w-0 flex-1 text-right" onClick={() => openExam(exam)}>
            <h3 className="text-sm font-bold">{exam.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{exam.stageName} · {exam.gradeName} · {exam.subjectName}</p>
            {exam.unitName && <p className="mt-1 text-xs text-primary">وحدة: {exam.unitName}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">{(exam.questions as unknown as ExamQuestion[]).length} سؤالًا · {exam.status === "published" ? "منشور" : "مسودة"}</p>
          </button>
          <Button type="button" size="icon" variant="ghost" aria-label={`تعديل ${exam.title}`} onClick={() => openExam(exam)}><Pencil /></Button>
          <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`حذف ${exam.title}`} onClick={() => void remove(exam)}><Trash2 /></Button>
        </Card>
      ))}
      {selected && (
        <section className="mt-4 border-t border-border pt-5" aria-label={`مراجعة ${selected.title}`}>
          <h2 className="text-lg">مراجعة وتعديل الاختبار</h2>
          <p className="mt-1 text-xs text-muted-foreground">{selected.stageName} · {selected.gradeName} · {selected.subjectName}{selected.unitName ? ` · ${selected.unitName}` : ""}</p>
          <label htmlFor="managed-exam-title" className="mt-4 block text-xs font-bold">عنوان الاختبار</label>
          <input id="managed-exam-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-border bg-card p-3" />
          <label htmlFor="managed-exam-status" className="mt-3 block text-xs font-bold">حالة الاختبار</label>
          <select id="managed-exam-status" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-2xl border border-border bg-card p-3"><option value="draft">مسودة</option><option value="published">منشور</option></select>
          <div className="mt-3 flex flex-col gap-4">
            {questions.map((question, index) => (
              <Card key={index}>
                <div className="flex items-center justify-between"><h3 className="text-sm">السؤال {index + 1}</h3><Button type="button" size="icon" variant="ghost" aria-label={`حذف سؤال الإدارة ${index + 1}`} onClick={() => setQuestions((old) => old.filter((_, i) => i !== index))}><Trash2 /></Button></div>
                <textarea aria-label={`نص سؤال الإدارة ${index + 1}`} value={question.q} onChange={(event) => update(index, { q: event.target.value })} className="mt-2 w-full rounded-2xl border border-border bg-background p-3 text-sm" />
                <div className="mt-2 flex flex-col gap-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2"><input type="radio" name={`managed-correct-${index}`} aria-label={`الإجابة الصحيحة لسؤال الإدارة ${index + 1} خيار ${optionIndex + 1}`} checked={question.correct === optionIndex} onChange={() => update(index, { correct: optionIndex })} /><input aria-label={`سؤال الإدارة ${index + 1} خيار ${optionIndex + 1}`} value={option} onChange={(event) => update(index, { options: question.options.map((old, i) => i === optionIndex ? event.target.value : old) })} className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2 text-sm" /></label>
                  ))}
                </div>
                <textarea aria-label={`تفسير سؤال الإدارة ${index + 1}`} value={question.hint} onChange={(event) => update(index, { hint: event.target.value })} className="mt-2 w-full rounded-2xl border border-border bg-background p-2 text-sm" placeholder="تفسير الإجابة" />
              </Card>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={() => setQuestions((old) => [...old, { q: "", options: ["", "", "", ""], correct: 0, hint: "" }])} className="mt-3 w-full"><Plus />إضافة سؤال</Button>
          <div className="mt-3 flex gap-2"><Button type="button" disabled={busy} onClick={() => void save()} className="flex-1">{busy ? <Loader2 className="animate-spin" /> : <Save />}حفظ التعديلات</Button><Button type="button" variant="outline" onClick={() => setSelected(null)}>إلغاء</Button></div>
        </section>
      )}
    </div>
  );
}
