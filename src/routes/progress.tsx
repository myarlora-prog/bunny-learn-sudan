import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Clock, Target, Trophy } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { allLessons, subjects, weeklyMinutes } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "تقدمي | سَقرو" },
      { name: "description", content: "تابع ساعات مذاكرتك، نسبة إنجاز كل مادة، وسلسلة أيامك المتواصلة مع سَقرو." },
      { property: "og:title", content: "تقدمي | سَقرو" },
      { property: "og:description", content: "إحصائيات واضحة تحفّزك على الاستمرار في المذاكرة." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { state } = useApp();
  const max = Math.max(...weeklyMinutes.map((d) => d.minutes));
  const total = weeklyMinutes.reduce((n, d) => n + d.minutes, 0);
  const percent = Math.round((state.completedLessons.length / allLessons.length) * 100);

  return (
    <Screen>
      <PageHeader title="تقدمي" subtitle="نظرة سريعة على أدائك هذا الأسبوع" />

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "أيام متواصلة", value: state.streak, Icon: Flame },
          { label: "دقائق هذا الأسبوع", value: total, Icon: Clock },
          { label: "إنجاز المنهج", value: `${percent}%`, Icon: Target },
          { label: "نقاطي", value: state.points, Icon: Trophy },
        ].map(({ label, value, Icon }) => (
          <Card key={label}>
            <Icon className="size-5 text-primary" />
            <p className="mt-2 text-xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <h2 className="text-base">نشاط الأسبوع</h2>
        <div className="mt-4 flex h-36 items-end justify-between gap-2">
          {weeklyMinutes.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="gradient-hero w-full rounded-t-xl transition-all duration-500"
                style={{ height: `${(d.minutes / max) * 100}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{d.day.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mb-3 mt-6 text-lg">إنجاز المواد</h2>
      <div className="flex flex-col gap-2.5">
        {subjects.map((s) => (
          <Card key={s.id} className="flex items-center gap-3">
            <span className="text-xl">{s.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{s.name}</span>
                <span className="text-muted-foreground">{s.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: s.color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Link to="/achievements">
        <Card className="mt-4 flex items-center gap-3">
          <Trophy className="size-6 text-warning" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">إنجازاتي ومكافآتي</h3>
            <p className="text-[11px] text-muted-foreground">اكتشف الأوسمة التي حصلت عليها</p>
          </div>
        </Card>
      </Link>
    </Screen>
  );
}
