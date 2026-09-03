import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { stages, subjects } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/curriculum/")({
  head: () => ({
    meta: [
      { title: "المنهج | بَني" },
      { name: "description", content: "تصفّح مواد المنهج السوداني ووحداته ودروسه داخل تطبيق بَني." },
      { property: "og:title", content: "المنهج | بَني" },
      { property: "og:description", content: "كل موادك ووحداتك ودروسك في مكان واحد منظّم." },
    ],
  }),
  component: CurriculumPage,
});

function CurriculumPage() {
  const { state } = useApp();
  const stage = stages.find((s) => s.id === state.stageId);
  const grade = stage?.grades.find((g) => g.id === state.gradeId);

  return (
    <Screen>
      <PageHeader
        title="المنهج"
        subtitle={grade ? `${stage?.name} · ${grade.name}` : "اختر مادة لتبدأ المذاكرة"}
      />

      <div className="flex flex-col gap-3">
        {subjects.map((s) => {
          const lessons = s.units.reduce((n, u) => n + u.lessons.length, 0);
          return (
            <Link key={s.id} to="/curriculum/$subjectId" params={{ subjectId: s.id }}>
              <Card className="flex items-center gap-4">
                <span
                  className="flex size-14 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: `color-mix(in oklab, ${s.color} 14%, transparent)` }}
                >
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{s.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {s.units.length} وحدات · {lessons} دروس
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.progress}%`, background: s.color }}
                    />
                  </div>
                </div>
                <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>
    </Screen>
  );
}
