import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ClipboardCheck } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { subjects } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/quizzes")({
  head: () => ({
    meta: [
      { title: "اختباري | سَقرو" },
      { name: "description", content: "كل اختبارات دروس المنهج السوداني المتاحة لك في مكان واحد." },
      { property: "og:title", content: "اختباري | سَقرو" },
      { property: "og:description", content: "راجع اختبارات دروسك واختبر فهمك مع سَقرو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizzesPage,
});

function QuizzesPage() {
  const { state } = useApp();
  const quizzes = subjects.flatMap((subject) =>
    subject.units.flatMap((unit) =>
      unit.lessons
        .filter((lesson) => lesson.quiz.length > 0)
        .map((lesson) => ({ lesson, subject, unit })),
    ),
  );

  return (
    <Screen>
      <PageHeader title="اختباري" subtitle="اختبارات دروسك في مكان واحد" />
      <div className="flex flex-col gap-3">
        {quizzes.map(({ lesson, subject, unit }) => {
          const completed = state.completedLessons.includes(lesson.id);
          return (
            <Link
              key={lesson.id}
              to="/lesson/$lessonId"
              params={{ lessonId: lesson.id }}
              search={{ tab: "quiz" }}
            >
              <Card className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                  <ClipboardCheck className="size-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold">{lesson.title}</h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {subject.icon} {subject.name} · {unit.title} · {lesson.quiz.length} أسئلة
                  </p>
                </div>
                {completed ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" />
                ) : (
                  <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </Screen>
  );
}