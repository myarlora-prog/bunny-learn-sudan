import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import mascotAsset from "@/assets/saqro-streak-mascot.png.asset.json";
import { Card, Screen } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/streak")({
  head: () => ({
    meta: [
      { title: "الاستريك | سَقرو" },
      { name: "description", content: "تابع سلسلة تعلّمك اليومية ونشاطك المستمر في سَقرو." },
      { property: "og:title", content: "الاستريك | سَقرو" },
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
    return [2, 1, 0].map((offset) => new Date(today.getFullYear(), today.getMonth() - offset, 1));
  }, []);

  return (
    <Screen className="pt-3">
      <div className="relative mx-auto h-48 w-full overflow-hidden">
        <img
          src={mascotAsset.url}
          alt="طالب سوداني يحمل كتباً وشعلة الاستمرار"
          className="mx-auto h-64 w-auto object-contain object-top"
        />
      </div>

      <Card className="relative z-10 -mt-3 p-5 text-center">
        <h1 className="text-2xl">{state.streak} {state.streak === 1 ? "يوم على التوالي!" : "أيام على التوالي!"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">لا توقف الحماس، حافظ على شعلتك!</p>

        <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-border p-3">
          {months.map((month) => (
            <MonthGrid key={month.toISOString()} month={month} activeDays={activityDays} />
          ))}
        </div>
      </Card>

      <Card className="mt-3 grid grid-cols-3 gap-2 p-3 text-center">
        <Stat icon={<Sparkles className="size-5 text-primary" />} label="نقاط التعلم" value={state.points.toLocaleString("ar-EG")} />
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
  const days = Array.from({ length: 35 }, (_, index) => index + 1);

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-5 gap-1.5" aria-label={`نشاط ${arabicMonths[month.getMonth()]}`}>
        {days.map((day) => {
          const valid = day <= count;
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