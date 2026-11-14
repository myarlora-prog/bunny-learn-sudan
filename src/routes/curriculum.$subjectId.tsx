import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { SaqroEmpty } from "@/components/saqro";
import { getSubject } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { isDbId, useSubjectTree } from "@/lib/curriculum-db";

export const Route = createFileRoute("/curriculum/$subjectId")({
  head: () => ({
    meta: [
      { title: "وحدات المادة | نوابغ" },
      { name: "description", content: "استعرض وحدات المادة ودروسها داخل تطبيق نوابغ التعليمي." },
      { property: "og:title", content: "وحدات المادة | نوابغ" },
      { property: "og:description", content: "وحدات ودروس منظّمة مع متابعة إنجازك في كل درس." },
    ],
  }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { state, isSuper, isAdmin } = useApp();
  const navigate = useNavigate();
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


  const currentId = subject.units
    .flatMap((u) => u.lessons)
    .find((l) => !state.completedLessons.includes(l.id))?.id;

  return (
    <Screen>
      <PageHeader title={`${subject.icon} ${subject.name}`} subtitle={`${subject.progress}% من المادة مكتمل`} back />

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${subject.progress}%`, background: subject.color }} />
      </div>

      <div className="flex flex-col items-center gap-6 rounded-3xl bg-card/60 px-3 py-6">
        {subject.units.map((unit) => (
          <section key={unit.id} className="flex w-full flex-col items-center">
            <h2 className="mb-4 rounded-full bg-primary-soft px-5 py-2 text-center text-sm text-primary">{unit.title}</h2>
            <div className="flex flex-col items-center">
              {unit.lessons.map((l, i) => {
                const done = state.completedLessons.includes(l.id);
                const current = l.id === currentId;
                const locked = !isSuper && !isAdmin && l.freeAccess === false;
                const body = (
                  <>
                    <span
                      className={cn(
                        "relative flex size-14 items-center justify-center rounded-full border-2 bg-card transition-shadow",
                        done
                          ? "border-warning text-warning shadow-[0_0_18px_4px_color-mix(in_oklab,var(--warning)_45%,transparent)]"
                          : current
                            ? "border-primary text-primary shadow-[0_0_18px_4px_color-mix(in_oklab,var(--primary)_40%,transparent)]"
                            : "border-primary/40 text-primary",
                      )}
                    >
                      <Lightbulb className={cn("size-7", done && "fill-warning/30")} />
                      {locked && (
                        <span className="absolute -top-1 -left-1 text-sm" aria-label="الدرس غير متاح حاليًا">💎</span>
                      )}
                    </span>
                    <span className="mt-2 max-w-[220px] text-center text-xs font-bold">{l.title}</span>
                  </>
                );
                return (
                  <div key={l.id} className="flex flex-col items-center">
                    {i > 0 && <span className="mb-2 h-6 w-px bg-primary/30" />}
                    {locked ? (
                      <button
                        type="button"
                        className="press flex flex-col items-center"
                        onClick={() => {
                          toast("تعرّف على طريقة فتح جميع الدروس 💎");
                          void navigate({ to: "/super" });
                        }}
                      >
                        {body}
                      </button>
                    ) : (
                      <Link to="/lesson/$lessonId" params={{ lessonId: l.id }} className="press flex flex-col items-center">
                        {body}
                      </Link>
                    )}
                    {i < unit.lessons.length - 1 && <span className="mt-2 h-6 w-px bg-primary/30" />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {subject.units.length === 0 && (
          <SaqroEmpty title="لا توجد وحدات بعد" desc="سيتم إضافة وحدات هذه المادة قريبًا." />
        )}
      </div>
    </Screen>
  );
}
