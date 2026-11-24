import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Sparkles, Layers, ListChecks, CheckCircle2, RotateCcw, Lightbulb, Loader2 } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { EnergyBadge, ZeroEnergyModal } from "@/components/energy";
import { Saqro, SaqroEmpty } from "@/components/saqro";
import { getLesson } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { isDbId, useLessonData } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { explanationHtml, looksLikeHtml } from "@/lib/sanitize-html";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { playAppSound } from "@/lib/sound";
import { LessonFlashcards } from "@/components/lesson-flashcards";

export const Route = createFileRoute("/lesson/$lessonId")({
  validateSearch: z.object({ tab: z.enum(["explain", "summary", "cards", "quiz"]).optional() }),
  head: () => ({
    meta: [
      { title: "الدرس | نوابغ" },
      { name: "description", content: "شرح مبسّط، ملخص ذكي، بطاقات مراجعة، واختبار مولّد بالذكاء الاصطناعي لكل درس." },
      { property: "og:title", content: "الدرس | نوابغ" },
      { property: "og:description", content: "اشرح، لخّص، راجع، واختبر نفسك في الدرس مع نوابغ." },
    ],
  }),
  component: LessonPage,
});

const tabs = [
  { id: "explain", label: "الشرح", Icon: BookOpen },
  { id: "summary", label: "الملخص", Icon: Sparkles },
  { id: "cards", label: "البطاقات", Icon: Layers },
  { id: "quiz", label: "الاختبار", Icon: ListChecks },
] as const;

function LessonPage() {
  const { lessonId } = Route.useParams();
  const search = Route.useSearch();
  const live = useLessonData(lessonId);
  const data = isDbId(lessonId) ? live.data : getLesson(lessonId);
  const { state, session, toggleLesson, spendEnergy, isSuper, isAdmin, refresh } = useApp();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>(search.tab ?? "explain");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [blocked, setBlocked] = useState(false);
  const freeAccess = data?.lesson.freeAccess;

  useEffect(() => {
    if (!session || !data || !isDbId(lessonId) || (freeAccess === false && !isSuper && !isAdmin)) return;
    let active = true;
    void supabase.rpc("record_lesson_open", { _lesson_id: lessonId }).then(({ error }) => {
      if (error) {
        console.error("lesson open could not be recorded", error);
        return;
      }
      if (!active) return;
      void queryClient.invalidateQueries({ queryKey: ["week-activity", session.user.id] });
      void queryClient.invalidateQueries({ queryKey: ["streak-activity-days"] });
      void refresh();
    });
    return () => { active = false; };
  }, [lessonId, session, data, freeAccess, isSuper, isAdmin, queryClient, refresh]);

  if (isDbId(lessonId) && live.isLoading) {
    return (
      <Screen nav={false}>
        <PageHeader title="الدرس" back />
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen nav={false}>
        <PageHeader title="الدرس غير متوفر" back />
        <SaqroEmpty title="لم أعثر على هذا الدرس" desc="عد إلى المنهج واختر درسًا آخر، وأنا في انتظارك." />
      </Screen>
    );
  }

  const { lesson, subject, unit } = data;
  const done = state.completedLessons.includes(lesson.id);
  const score = lesson.quiz.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
  const answered = Object.keys(answers).length;

  if (lesson.freeAccess === false && !isSuper && !isAdmin) {
    return (
      <Screen nav={false}>
        <PageHeader title="" back />
        <SaqroEmpty title="هذا الدرس غير متاح حاليًا 💎" desc="يمكنك فتح جميع دروس صفك والاستفادة من الشرح والملخصات والبطاقات." />
        <Link to="/super" className="press gradient-hero mt-4 block rounded-2xl py-3 text-center text-sm font-bold text-primary-foreground">
          كيفية فتح جميع الدروس
        </Link>
      </Screen>
    );
  }




  return (
    <Screen nav={false}>
      <PageHeader title="" back action={<EnergyBadge />} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            data-tour={`lesson-tab-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "press flex shrink-0 items-center gap-1.5 rounded-2xl border border-border px-3.5 py-2 text-xs font-bold transition-all",
              tab === id
                ? "gradient-hero border-transparent text-primary-foreground shadow-[var(--shadow-soft)]"
                : "bg-card text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "explain" && (
        <div key="explain" className="page-enter flex flex-col gap-3">
          {lesson.explanation.map((p, i) => (
            <Card key={i} className="text-sm leading-loose">
              <div className="lesson-rich" dangerouslySetInnerHTML={{ __html: explanationHtml(p) }} />
            </Card>
          ))}
        </div>
      )}

      {tab === "summary" && (
        <div key="summary" className="page-enter">
          <Card className="gradient-hero flex items-center gap-3 border-transparent">
            <Saqro size={56} />
            <p className="text-sm font-bold text-primary-foreground">ملخص نوابغ الذكي — أهم ما يجب أن تتذكره</p>
          </Card>
          <div className="mt-3 flex flex-col gap-2.5">
            {lesson.summary.map((s, i) => (
              <Card key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </span>
                {looksLikeHtml(s) ? <div className="lesson-rich min-w-0 flex-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: explanationHtml(s) }} /> : <span className="leading-relaxed">{s}</span>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "cards" && lesson.flashcards.length > 0 && (
        <div key="cards" className="page-enter">
          <LessonFlashcards cards={lesson.flashcards} sound={state.sound} />
        </div>
      )}

      {tab === "quiz" && (
        <div key="quiz" className="page-enter flex flex-col gap-3">
          <Card className="flex items-center gap-3">
            <Sparkles className="size-5 text-primary" />
            <p className="flex-1 text-xs text-muted-foreground">اختبار مولّد بالذكاء الاصطناعي من محتوى هذا الدرس</p>
            <span className="text-sm font-bold text-primary">
              {score}/{lesson.quiz.length}
            </span>
          </Card>

          {lesson.quiz.map((q, qi) => {
            const picked = answers[qi];
            return (
              <Card key={qi}>
                <h3 className="text-sm font-bold leading-relaxed">{q.q}</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi;
                    const correct = oi === q.correct;
                    const reveal = picked !== undefined;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={reveal}
                        onClick={async () => {
                          if (!correct && !isSuper) {
                            const res = await spendEnergy(1);
                            if (!res.ok) {
                              setBlocked(true);
                              return;
                            }
                          }
                          setAnswers((a) => ({ ...a, [qi]: oi }));
                          playAppSound(correct ? "correct" : "incorrect", state.sound);
                        }}
                        className={cn(
                          "press rounded-2xl border border-border px-4 py-3 text-right text-sm transition-colors",
                          reveal && correct && "border-success bg-success/10 font-bold text-success",
                          reveal && isPicked && !correct && "border-destructive bg-destructive/10 text-destructive",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {picked !== undefined && (
                  <p className="mt-3 flex items-start gap-2 rounded-2xl bg-primary-soft p-3 text-xs leading-relaxed text-accent-foreground">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    {q.hint}
                  </p>
                )}
              </Card>
            );
          })}

          {answered > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="press flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold"
            >
              <RotateCcw className="size-4" /> إعادة الاختبار
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        data-tour="lesson-complete"
        onClick={async () => {
          const completing = !done;
          await toggleLesson(lesson.id);
          if (completing) playAppSound("complete", state.sound);
        }}
        className={cn(
          "press mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-3xl text-base font-bold shadow-[var(--shadow-float)]",
          done ? "border border-success bg-success/10 text-success" : "gradient-hero text-primary-foreground",
        )}
      >
        <CheckCircle2 className="size-5" />
        {done ? "تم إكمال الدرس" : "وضع علامة كمكتمل"}
      </button>

      <ZeroEnergyModal open={blocked} onClose={() => setBlocked(false)} />
    </Screen>
  );
}
