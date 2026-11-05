import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { SaqroEmpty } from "@/components/saqro";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { useGrades, useStages, useSubjects } from "@/lib/curriculum-db";

export const Route = createFileRoute("/curriculum/")({
  head: () => ({
    meta: [
      { title: "المكتبة | نوابغ" },
      { name: "description", content: "تصفّح مواد المنهج السوداني ووحداته ودروسه داخل تطبيق نوابغ." },
      { property: "og:title", content: "المكتبة | نوابغ" },
      { property: "og:description", content: "كل موادك ووحداتك ودروسك في مكان واحد منظّم." },
    ],
  }),
  component: CurriculumPage,
});

/** Published unit/lesson counts per subject, for the library cards. */
function useSubjectCounts(subjectIds: string[]) {
  return useQuery({
    queryKey: ["subject-counts", subjectIds],
    enabled: subjectIds.length > 0,
    queryFn: async (): Promise<Record<string, { units: number; lessons: number; ids: string[] }>> => {
      const { data: units } = await supabase
        .from("units")
        .select("id,subject_id")
        .in("subject_id", subjectIds)
        .eq("published", true);
      const unitIds = (units ?? []).map((u) => u.id);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,unit_id")
        .in("unit_id", unitIds.length ? unitIds : ["-"])
        .eq("published", true);
      const lessonsByUnit = new Map<string, string[]>();
      for (const l of lessons ?? []) lessonsByUnit.set(l.unit_id, [...(lessonsByUnit.get(l.unit_id) ?? []), l.id]);
      const counts: Record<string, { units: number; lessons: number; ids: string[] }> = {};
      for (const id of subjectIds) counts[id] = { units: 0, lessons: 0, ids: [] };
      for (const u of units ?? []) {
        const c = counts[u.subject_id];
        if (!c) continue;
        c.units += 1;
        const ls = lessonsByUnit.get(u.id) ?? [];
        c.lessons += ls.length;
        c.ids.push(...ls);
      }
      return counts;
    },
    staleTime: 60 * 1000,
  });
}

function CurriculumPage() {
  const { state } = useApp();
  const stagesQ = useStages();
  const gradesQ = useGrades(state.stageId);
  const subjectsQ = useSubjects(state.gradeId);
  const subjectIds = (subjectsQ.data ?? []).map((s) => s.id);
  const countsQ = useSubjectCounts(subjectIds);

  const stage = (stagesQ.data ?? []).find((s) => s.id === state.stageId);
  const grade = (gradesQ.data ?? []).find((g) => g.id === state.gradeId);
  const loading = subjectsQ.isLoading || (!!state.gradeId && countsQ.isLoading);

  return (
    <Screen>
      <PageHeader
        title="المكتبة"
        subtitle={grade ? `${stage?.name} · ${grade.name}` : "اختر مادة لتبدأ المذاكرة"}
      />

      {loading ? (
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" />
      ) : (subjectsQ.data ?? []).length === 0 ? (
        <SaqroEmpty
          title="لا توجد مواد منشورة بعد"
          desc="سيضيف المشرف مواد صفك هنا فور نشرها. عُد لاحقًا."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(subjectsQ.data ?? []).map((s) => {
            const c = countsQ.data?.[s.id] ?? { units: 0, lessons: 0, ids: [] };
            const doneCount = c.ids.filter((id) => state.completedLessons.includes(id)).length;
            const pct = c.lessons ? Math.round((doneCount / c.lessons) * 100) : 0;
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
                      {c.units} وحدات · {c.lessons} دروس
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: s.color }}
                      />
                    </div>
                  </div>
                  <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
