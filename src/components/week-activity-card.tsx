import { useApp } from "@/lib/app-state";
import { localKey, useWeekActivity } from "@/lib/activity-db";
import { Card } from "@/components/app-shell";
import { cn } from "@/lib/utils";

/** "فرصة جديدة تبدأ من اليوم" — real weekly lesson/quiz activity, orange accents. */
export function WeekActivityCard() {
  const { session, state } = useApp();
  const { data } = useWeekActivity(session?.user.id ?? null, state.completedLessons.length);
  const today = localKey(new Date());
  return (
    <Card className="sticky top-0 z-30 mb-4 !transform-none rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">فرصة جديدة تبدأ من اليوم</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            هذا الأسبوع: {data?.totalLessons ?? 0} دروس · {data?.totalQuizzes ?? 0} اختبارات
          </p>
          <div className="mt-4 flex justify-between gap-1">
            {(data?.days ?? []).map((d) => {
              const active = d.lessons + d.quizzes > 0;
              const isToday = d.key === today;
              return (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className={cn("text-xs", isToday ? "font-bold text-warning" : "text-muted-foreground")}>
                    {d.label.replace("ال", "").charAt(0)}
                  </span>
                  <span
                    className={cn(
                      "size-8 rounded-full border-2",
                      active ? "border-warning bg-warning" : "border-border bg-muted/40",
                      isToday && !active && "border-warning bg-background",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <svg viewBox="0 0 64 64" className="size-20 shrink-0" aria-hidden>
          <path d="M8 40c0-4 5-5 8-2l6 5V30c0-3 5-3 5 0v8h10v-8c0-3 5-3 5 0v10l5-4c3-2 8 0 7 4-2 8-10 18-23 18S8 48 8 40Z" className="fill-primary/40" />
          <path d="M32 4c3 8 12 12 12 22a12 12 0 0 1-24 0c0-6 3-9 6-12 0 5 2 7 4 7-1-7 0-12 2-17Z" fill="var(--flame-1, orange)" />
          <path d="M32 18c2 5 6 7 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 1 2 2 3 3 3 0-3 0-6 0-9Z" fill="var(--flame-3, gold)" />
        </svg>
      </div>
    </Card>
  );
}
