import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { SaqroEmpty } from "@/components/saqro";
import { getSubject } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { isDbId, useSubjectTree } from "@/lib/curriculum-db";

export const Route = createFileRoute("/curriculum/$subjectId")({
  head: () => ({
    meta: [
      { title: "وحدات المادة | سَقرو" },
      { name: "description", content: "استعرض وحدات المادة ودروسها ومدة كل درس داخل تطبيق سَقرو التعليمي." },
      { property: "og:title", content: "وحدات المادة | سَقرو" },
      { property: "og:description", content: "وحدات ودروس منظّمة مع متابعة إنجازك في كل درس." },
    ],
  }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { state } = useApp();
  const live = useSubjectTree(subjectId);
  const subject = isDbId(subjectId) ? live.data : getSubject(subjectId);

  if (isDbId(subjectId) && live.isLoading) {
    return (
      <Screen>
        <PageHeader title="المادة" back />
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" />
      </Screen>
    );
  }

  if (!subject) {
    return (
      <Screen>
        <PageHeader title="المادة غير متوفرة" back />
        <SaqroEmpty title="لم أجد هذه المادة" desc="ربما تم تغيير المنهج. ارجع واختر مادة أخرى من القائمة." />
      </Screen>
    );
  }


  return (
    <Screen>
      <PageHeader title={`${subject.icon} ${subject.name}`} subtitle={`${subject.progress}% من المادة مكتمل`} back />

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${subject.progress}%`, background: subject.color }} />
      </div>

      <div className="flex flex-col gap-5">
        {subject.units.map((unit) => (
          <section key={unit.id}>
            <h2 className="mb-2 text-base">{unit.title}</h2>
            <div className="flex flex-col gap-2.5">
              {unit.lessons.map((l) => {
                const done = state.completedLessons.includes(l.id);
                return (
                  <Link key={l.id} to="/lesson/$lessonId" params={{ lessonId: l.id }}>
                    <Card className="flex items-center gap-3">
                      {done ? (
                        <CheckCircle2 className="size-6 shrink-0 text-success" />
                      ) : (
                        <Circle className="size-6 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold">{l.title}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" /> {l.minutes} دقيقة · {l.flashcards.length} بطاقة
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Screen>
  );
}
