import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { plannerTasks } from "@/data/curriculum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "الخطة اليومية | سَقرو" },
      { name: "description", content: "نظّم يومك الدراسي مع سَقرو: مهام محددة بالوقت لكل مادة ومتابعة إنجازك." },
      { property: "og:title", content: "الخطة اليومية | سَقرو" },
      { property: "og:description", content: "خطة مذاكرة يومية بسيطة تساعدك على الالتزام." },
    ],
  }),
  component: PlannerPage,
});

const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function PlannerPage() {
  const [tasks, setTasks] = useState(plannerTasks);
  const [day, setDay] = useState(2);
  const done = tasks.filter((t) => t.done).length;
  const percent = Math.round((done / tasks.length) * 100);

  return (
    <Screen>
      <PageHeader title="خطة اليوم" subtitle="خطوة صغيرة كل يوم تصنع الفرق" back />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(i)}
            className={cn(
              "press shrink-0 rounded-2xl border border-border px-4 py-2 text-xs font-bold transition-all",
              i === day ? "gradient-hero border-transparent text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <Card className="gradient-hero flex items-center gap-3 border-transparent">
        <Saqro variant="study" size={68} float />
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-base text-primary-foreground">
            أنجزت {done} من {tasks.length} مهام
          </h2>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-foreground/25">
            <div className="h-full rounded-full bg-primary-foreground" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2.5">
        {tasks.map((t) => (
          <Card
            key={t.id}
            className="flex items-center gap-3"
            onClick={() => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
          >
            {t.done ? (
              <CheckCircle2 className="size-6 shrink-0 text-success" />
            ) : (
              <Circle className="size-6 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className={cn("truncate text-sm font-bold", t.done && "text-muted-foreground line-through")}>
                {t.title}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {t.time} · {t.subject}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <button
        type="button"
        className="press mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-primary/40 py-3.5 text-sm font-bold text-primary"
      >
        <Plus className="size-4" /> إضافة مهمة جديدة
      </button>
    </Screen>
  );
}
