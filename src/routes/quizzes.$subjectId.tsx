import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ClipboardCheck, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { SaqroEmpty } from "@/components/saqro";
import { getSubject, type Subject } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { isDbId, useSubjectQuizCounts, useSubjectTree } from "@/lib/curriculum-db";
import type { ExamQuestion } from "@/lib/exam.functions";
import { validExamQuestions } from "@/lib/exam-utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quizzes/$subjectId")({
  validateSearch: z.object({ mode: z.enum(["exam", "units"]).optional(), exam: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "اختبار المادة | نوابغ" },
      { name: "description", content: "اختبار شامل للمادة واختبارات الوحدات داخل نوابغ." },
      { property: "og:title", content: "اختبار المادة | نوابغ" },
      { property: "og:description", content: "اختبر فهمك للمادة كاملة أو وحدة بوحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectQuizPage,
});

function SubjectQuizPage() {
  const { subjectId } = Route.useParams();
  const { mode = "units", exam } = Route.useSearch();
  const live = useSubjectTree(subjectId);
  const subject = isDbId(subjectId) ? live.data : getSubject(subjectId);
  if (isDbId(subjectId) && live.isLoading) {
    return (
      <Screen>
        <PageHeader title="اختباري" back />
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" />
      </Screen>
    );
  }
  if (!subject) {
    return (
      <Screen>
        <PageHeader title="اختباري" back />
        <SaqroEmpty title="المادة غير متوفرة" desc="ارجع واختر مادة أخرى." />
      </Screen>
    );
  }
  return mode === "exam" ? <SubjectExam subject={subject} examId={exam} /> : <UnitQuizzes subject={subject} />;
}

function UnitQuizzes({ subject }: { subject: Subject }) {
  const { state } = useApp();
  const countsQ = useSubjectQuizCounts(subject.id);
  const unitExams = useQuery({ queryKey: ["published-unit-exams", subject.id], staleTime: 0, refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase.from("subject_exams").select("id,unit_id,title,questions").eq("subject_id", subject.id).eq("status", "published").not("unit_id", "is", null);
      if (error) throw error;
      return (data ?? []).filter((e) => validExamQuestions(e.questions));
    },
  });
  const countOf = (lessonId: string) =>
    isDbId(lessonId) ? (countsQ.data?.[lessonId] ?? 0) : 0;
  return (
    <Screen>
      <PageHeader title={`${subject.icon} اختبارات الوحدات`} subtitle={subject.name} back />
      <div className="flex flex-col gap-5">
        {subject.units.map((unit) => (
          <section key={unit.id}>
            <h2 className="mb-2 text-base">{unit.title}</h2>
            <div className="flex flex-col gap-2.5">
              {unitExams.data?.filter((e) => e.unit_id === unit.id).map((e) => (
                <Link key={e.id} to="/quizzes/$subjectId" params={{ subjectId: subject.id }} search={{ mode: "exam", exam: e.id }}>
                  <Card className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                      <ClipboardCheck className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">{e.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{(e.questions as unknown[]).length} أسئلة</p>
                    </div>
                    <ChevronLeft className="size-5 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
              {unit.lessons
                .filter((l) => (isDbId(l.id) ? countOf(l.id) > 0 : l.quiz.length > 0))
                .map((lesson) => (
                <Link key={lesson.id} to="/lesson/$lessonId" params={{ lessonId: lesson.id }} search={{ tab: "quiz" }}>
                  <Card className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                      <ClipboardCheck className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">{lesson.title}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isDbId(lesson.id) ? countOf(lesson.id) : lesson.quiz.length} أسئلة
                      </p>
                    </div>
                    {state.completedLessons.includes(lesson.id) ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : (
                      <ChevronLeft className="size-5 text-muted-foreground" />
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {subject.units.length === 0 && <SaqroEmpty title="لا توجد وحدات بعد" desc="ستضاف قريبًا." />}
      </div>
    </Screen>
  );
}

function SubjectExam({ subject, examId }: { subject: Subject; examId?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const exams = useQuery({ queryKey: ["published-exams", subject.id, examId ?? "subject"], staleTime: 0, refetchOnMount: "always", refetchInterval: 15000,
    queryFn: async () => {
      let q = supabase.from("subject_exams").select("id,title,questions").eq("subject_id", subject.id).eq("status", "published");
      q = examId ? q.eq("id", examId) : q.is("unit_id", null);
      const { data, error } = await q.order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((exam) => validExamQuestions(exam.questions));
    },
  });
  const exam = exams.data?.find((e) => e.id === selected) ?? exams.data?.[0];
  if (exams.isPending) return <Screen><PageHeader title={`اختبار ${subject.name}`} back /><Loader2 className="mx-auto animate-spin text-primary" /></Screen>;
  if (exams.isError) return <Screen><PageHeader title={`اختبار ${subject.name}`} back /><p className="text-destructive">تعذر تحميل الاختبارات</p><Button onClick={() => void exams.refetch()}>إعادة المحاولة</Button></Screen>;
  if (!exam) return <Screen><PageHeader title={`اختبار ${subject.name}`} back /><SaqroEmpty title="لا يوجد اختبار منشور لهذه المادة بعد" desc="سيظهر هنا بعد نشره من المالك." /></Screen>;
  return <ExamRunner key={exam.id} subject={subject} title={exam.title} questions={exam.questions as unknown as ExamQuestion[]} selector={
    (exams.data?.length ?? 0) > 1 ? <select aria-label="اختر الاختبار" value={exam.id} onChange={(e) => setSelected(e.target.value)} className="mb-4 w-full rounded-lg border border-border bg-card p-3">{exams.data?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select> : null
  } />;
}

function ExamRunner({ subject, title, questions, selector }: { subject: Subject; title: string; questions: ExamQuestion[]; selector: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i];
  const done = questions.length > 0 && i >= questions.length;

  return (
    <Screen>
      <PageHeader title={`${subject.icon} اختبار ${subject.name}`} subtitle={title} back />
      {selector}
      {done && (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-4xl font-bold text-primary">
            {score} / {questions.length}
          </p>
          <p className="text-sm text-muted-foreground">انتهى الاختبار</p>
          <button
            type="button"
            onClick={() => { setI(0); setPicked(null); setScore(0); }}
            className="press gradient-hero mt-2 flex items-center gap-2 rounded-2xl px-6 py-3 font-bold text-primary-foreground"
          >
            <RotateCcw className="size-4" /> اختبار جديد
          </button>
        </Card>
      )}
      {q && !done && (
        <div className="flex flex-col gap-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            السؤال {i + 1} من {questions.length}
          </p>
          <Card>
            <h2 className="text-lg leading-relaxed">{q.q}</h2>
          </Card>
          {q.options.map((o, k) => {
            const isRight = picked !== null && k === q.correct;
            const isWrong = picked === k && k !== q.correct;
            return (
              <button
                key={k}
                type="button"
                disabled={picked !== null}
                onClick={() => {
                  setPicked(k);
                  if (k === q.correct) setScore((s) => s + 1);
                }}
                className={cn(
                  "press flex items-center gap-3 rounded-2xl border-2 bg-card p-4 text-right text-sm font-medium",
                  isRight ? "border-success" : isWrong ? "border-destructive" : "border-border",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {"أبجد"[k]}
                </span>
                <span className="flex-1">{o}</span>
                {isRight && <CheckCircle2 className="size-5 text-success" />}
                {isWrong && <XCircle className="size-5 text-destructive" />}
              </button>
            );
          })}
          {picked !== null && (
            <>
              {q.hint && <Card className="text-sm text-muted-foreground">💡 {q.hint}</Card>}
              <button
                type="button"
                onClick={() => {
                  setI((x) => x + 1);
                  setPicked(null);
                }}
                className="press gradient-hero rounded-2xl py-4 font-bold text-primary-foreground"
              >
                {i + 1 < questions.length ? "السؤال التالي" : "عرض النتيجة"}
              </button>
            </>
          )}
        </div>
      )}
    </Screen>
  );
}
