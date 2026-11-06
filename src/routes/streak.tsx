import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Trophy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Card, Screen } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/streak")({
  head: () => ({
    meta: [
      { title: "التقدم | نوابغ" },
      { name: "description", content: "تابع سلسلة تعلّمك اليومية ونشاطك المستمر في نوابغ." },
      { property: "og:title", content: "التقدم | نوابغ" },
      { property: "og:description", content: "حافظ على حماسك وتابع أيام تعلّمك المتواصلة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StreakPage,
});

const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function useActivityDays(enabled: boolean) {
  return useQuery({
    queryKey: ["streak-activity-days"],
    enabled,
    queryFn: async () => {
      const [{ data: lessons }, { data: quizzes }] = await Promise.all([
        supabase.from("lesson_progress").select("completed_at"),
        supabase.from("quiz_attempts").select("created_at"),
      ]);
      return new Set([
        ...(lessons ?? []).map((item) => dateKey(new Date(item.completed_at))),
        ...(quizzes ?? []).map((item) => dateKey(new Date(item.created_at))),
      ]);
    },
  });
}

function StreakPage() {
  const { state, session } = useApp();
  const { data: activityDays = new Set<string>() } = useActivityDays(Boolean(session));
  const [showGuide, setShowGuide] = useState(false);
  const months = useMemo(() => {
    const today = new Date();
    return [1, 0].map((offset) => new Date(today.getFullYear(), today.getMonth() - offset, 1));
  }, []);

  return (
    <Screen className="pt-3">
      <FlameHero />

      <Card className="relative z-10 -mt-6 p-5 text-center">
        <h1 className="text-2xl">{state.streak} {state.streak === 1 ? "يوم على التوالي!" : "أيام على التوالي!"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">لا توقف الحماس، حافظ على شعلتك!</p>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-border p-3">
          {months.map((month) => (
            <MonthGrid key={month.toISOString()} month={month} activeDays={activityDays} />
          ))}
        </div>
      </Card>

      <Card className="mt-3 grid grid-cols-2 gap-2 p-3 text-center">
        <Stat icon={<Flame className="size-5 text-warning" />} label="الاستريك الحالي" value={state.streak} />
        <Stat icon={<Trophy className="size-5 text-warning" />} label="أعلى استريك" value={state.longestStreak} />
      </Card>

      <Button
        type="button"
        onClick={() => setShowGuide((value) => !value)}
        className="mt-4 h-14 w-full rounded-2xl text-base font-bold shadow-[var(--shadow-float)]"
      >
        كيف تحافظ على الاستريك؟
      </Button>

      {showGuide && (
        <Card className="mt-3 text-sm leading-loose text-muted-foreground">
          أكمل درساً أو اختباراً كل يوم. الاستمرار اليومي يحافظ على شعلتك ويرفع أعلى استريك لك.
        </Card>
      )}
    </Screen>
  );
}

function MonthGrid({ month, activeDays }: { month: Date; activeDays: Set<string> }) {
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, index) => index + 1);

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-5 gap-1.5" aria-label={`نشاط ${arabicMonths[month.getMonth()]}`}>
        {days.map((day) => {
          const valid = true;
          const active = valid && activeDays.has(dateKey(new Date(month.getFullYear(), month.getMonth(), day)));
          const today = valid && dateKey(new Date(month.getFullYear(), month.getMonth(), day)) === dateKey(new Date());
          return (
            <span
              key={day}
              className={cn(
                "aspect-square rounded-full border",
                active ? "border-warning bg-warning" : "border-border bg-muted/40",
                today && !active && "border-2 border-warning bg-background",
              )}
            />
          );
        })}
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{arabicMonths[month.getMonth()]}</p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-border px-1 py-3">
      {icon}
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <strong className="text-lg">{value}</strong>
    </div>
  );
}
function FlameHero() {
  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center" aria-hidden>
      <span className="flame-glow absolute size-32 rounded-full" />
      <span className="flame-orbit absolute inset-4">
        <span className="flame-spark absolute left-1/2 top-0 size-2.5 -translate-x-1/2 rounded-full" />
      </span>
      <svg viewBox="0 0 64 80" className="flame-body relative h-28 w-24">
        <defs>
          <linearGradient id="fo" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--flame-1)" />
            <stop offset="1" stopColor="var(--flame-2)" />
          </linearGradient>
          <linearGradient id="fi" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--flame-3)" />
            <stop offset="1" stopColor="var(--flame-2)" />
          </linearGradient>
        </defs>
        <path d="M32 2C36 18 54 28 54 50a22 22 0 0 1-44 0c0-10 5-16 10-21 0 8 4 12 8 12-2-14 2-28 6-39Z" fill="url(#fo)" />
        <path className="flame-inner" d="M32 38c3 8 12 12 12 22a12 12 0 0 1-24 0c0-6 4-9 6-12 1 4 3 6 5 6-1-6 0-12 1-16Z" fill="url(#fi)" />
      </svg>
    </div>
  );
}
