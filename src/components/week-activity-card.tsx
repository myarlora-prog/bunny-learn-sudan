import { useApp } from "@/lib/app-state";
import { localKey, useWeekActivity } from "@/lib/activity-db";
import { Card } from "@/components/app-shell";
import { cn } from "@/lib/utils";

/** "فرصة جديدة تبدأ من اليوم" — real weekly lesson/quiz activity. */
export function WeekActivityCard() {
  const { session, state } = useApp();
  const { data } = useWeekActivity(session?.user.id ?? null, state.completedLessons.length);
  const today = localKey(new Date());
  return (
    <Card className="sticky top-0 z-30 mb-4 !transform-none">
      <h2 className="text-base">فرصة جديدة تبدأ من اليوم</h2>
      <p className="mt-1 text-[11px] text-muted-foreground">
        هذا الأسبوع: {data?.totalLessons ?? 0} دروس · {data?.totalQuizzes ?? 0} اختبارات
      </p>
      <div className="mt-3 flex justify-between gap-1">
        {(data?.days ?? []).map((d) => {
          const active = d.lessons + d.quizzes > 0;
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "size-7 rounded-full border",
                  active ? "border-transparent gradient-hero" : "border-border bg-muted/50",
                  d.key === today && !active && "border-2 border-primary",
                )}
              />
              <span className="text-[9px] text-muted-foreground">{d.label.replace("ال", "")}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
