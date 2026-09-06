import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles, Target, CalendarDays, Trophy, ChevronLeft } from "lucide-react";
import { Card, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { allLessons, plannerTasks, subjects } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية | سَقرو" },
      { name: "description", content: "لوحتك اليومية في سَقرو: خطة المذاكرة، متابعة المواد، والدرس التالي." },
      { property: "og:title", content: "الرئيسية | سَقرو" },
      { property: "og:description", content: "تابع خطتك اليومية وتقدمك في المنهج السوداني مع سَقرو." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { state } = useApp();
  const done = state.completedLessons.length;
  const percent = Math.round((done / allLessons.length) * 100);
  const next = allLessons.find((l) => !state.completedLessons.includes(l.id)) ?? allLessons[0]!;
  const todo = plannerTasks.filter((t) => !t.done).length;

  return (
    <Screen>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">مساء الخير 🌙</p>
          <h1 className="text-2xl">{state.name || "طالب سَقرو"}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-soft)]">
          <Flame className="size-4 text-warning" />
          <span className="text-sm font-bold">{state.streak}</span>
        </div>
      </div>

      <div className="gradient-hero rise relative overflow-hidden rounded-3xl p-5 shadow-[var(--shadow-float)]">
        <div className="relative z-10 max-w-[62%]">
          <p className="text-xs font-medium text-primary-foreground/80">تابع من حيث توقفت</p>
          <h2 className="mt-1 text-lg text-primary-foreground">{next.title}</h2>
          <p className="mt-1 text-xs text-primary-foreground/80">{next.minutes} دقيقة · شرح + ملخص + اختبار</p>
          <Link
            to="/lesson/$lessonId"
            params={{ lessonId: next.id }}
            className="press mt-4 inline-flex items-center gap-1 rounded-2xl bg-card px-4 py-2.5 text-sm font-bold text-primary"
          >
            ابدأ الدرس <ChevronLeft className="size-4" />
          </Link>
        </div>
        <Saqro size={140} float className="absolute -bottom-3 left-1 z-0" priority />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "نقاطي", value: state.points, Icon: Sparkles },
          { label: "إنجاز المنهج", value: `${percent}%`, Icon: Target },
          { label: "مهام اليوم", value: todo, Icon: CalendarDays },
        ].map(({ label, value, Icon }) => (
          <Card key={label} className="flex flex-col items-center gap-1 p-3 text-center">
            <Icon className="size-5 text-primary" />
            <span className="text-lg font-bold">{value}</span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </Card>
        ))}
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">موادي</h2>
          <Link to="/curriculum" className="text-xs font-bold text-primary">
            عرض الكل
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {subjects.map((s) => (
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

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/planner">
          <Card className="h-full">
            <CalendarDays className="size-6 text-primary" />
            <h3 className="mt-2 text-sm font-bold">خطة اليوم</h3>
            <p className="text-[11px] text-muted-foreground">{todo} مهام متبقية</p>
          </Card>
        </Link>
        <Link to="/achievements">
          <Card className="h-full">
            <Trophy className="size-6 text-warning" />
            <h3 className="mt-2 text-sm font-bold">إنجازاتي</h3>
            <p className="text-[11px] text-muted-foreground">٣ أوسمة مكتسبة</p>
          </Card>
        </Link>
      </section>

      <Link to="/saqro">
        <Card className="mt-3 flex items-center gap-3">
          <Saqro size={54} />
          <div className="flex-1">
            <h3 className="text-sm font-bold">اسأل سَقرو الذكي</h3>
            <p className="text-[11px] text-muted-foreground">اشرح لي، لخّص لي، أو اختبرني في أي درس</p>
          </div>
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Card>
      </Link>
    </Screen>
  );
}
