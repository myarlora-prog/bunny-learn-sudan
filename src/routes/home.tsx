import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, CalendarDays, ChevronLeft } from "lucide-react";
import { Card, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { useSubjects } from "@/lib/curriculum-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية | نوابغ" },
      { name: "description", content: "لوحتك اليومية في نوابغ: خطة المذاكرة، متابعة المواد، والدرس التالي." },
      { property: "og:title", content: "الرئيسية | نوابغ" },
      { property: "og:description", content: "تابع خطتك اليومية وتقدمك في المنهج السوداني مع نوابغ." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { state } = useApp();
  const { data: subjects } = useSubjects(state.gradeId);

  return (
    <Screen>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">مساء الخير 🌙</p>
          <h1 className="text-2xl">{state.name || "طالب نوابغ"}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-soft)]">
          <Flame className="size-4 text-warning" />
          <span className="text-sm font-bold">{state.streak}</span>
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">موادي</h2>
          <Link to="/curriculum" className="text-xs font-bold text-primary">
            عرض الكل
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {(subjects ?? []).map((s) => (
            <Link key={s.id} to="/curriculum/$subjectId" params={{ subjectId: s.id }}>
              <Card className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-xl">
                  {s.icon}
                </span>
                <h3 className="flex-1 text-sm font-bold">{s.name}</h3>
                <ChevronLeft className="size-5 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Link to="/planner">
        <Card className="mt-6 flex items-center gap-3">
          <CalendarDays className="size-6 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">الخطة اليومية</h3>
            <p className="text-[11px] text-muted-foreground">نظّم مذاكرتك اليومية والأسبوعية</p>
          </div>
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Card>
      </Link>

      <Link to="/saqro">
        <Card className="mt-3 flex items-center gap-3">
          <Saqro size={54} />
          <div className="flex-1">
            <h3 className="text-sm font-bold">اسأل نوابغ الذكي</h3>
            <p className="text-[11px] text-muted-foreground">اشرح لي، لخّص لي، أو اختبرني في أي درس</p>
          </div>
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Card>
      </Link>
    </Screen>
  );
}
