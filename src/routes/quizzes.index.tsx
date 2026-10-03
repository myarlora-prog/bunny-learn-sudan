import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader, Screen } from "@/components/app-shell";
import { subjects } from "@/data/curriculum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quizzes/")({
  head: () => ({
    meta: [
      { title: "اختباري | سَقرو" },
      { name: "description", content: "اختر مادتك وابدأ اختبارًا شاملًا أو اختبارات الوحدات في سَقرو." },
      { property: "og:title", content: "اختباري | سَقرو" },
      { property: "og:description", content: "اختبارات المواد والوحدات للمنهج السوداني مع سَقرو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizzesPage,
});

function QuizzesPage() {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const n = subjects.length;
  const go = (d: number) => setIndex((i) => (i + d + n) % n);
  const current = subjects[index]!;
  const quizCount = current.units.reduce((a, u) => a + u.lessons.filter((l) => l.quiz.length).length, 0);

  return (
    <Screen>
      <PageHeader title="اختباري" subtitle="اختر المادة واختبر نفسك" />

      <div
        className="relative mx-auto mt-4 h-[300px] select-none overflow-hidden [perspective:1000px]"
        onTouchStart={(e) => (startX.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0]!.clientX - startX.current;
          if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        {subjects.map((s, i) => {
          let off = i - index;
          if (off > n / 2) off -= n;
          if (off < -n / 2) off += n;
          const visible = Math.abs(off) <= 1;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => off !== 0 && go(off)}
              aria-label={s.name}
              className="absolute left-1/2 top-0 h-[280px] w-[190px] transition-all duration-500 ease-out"
              style={{
                transform: `translateX(calc(-50% + ${-off * 150}px)) rotateY(${off * 28}deg) scale(${off === 0 ? 1 : 0.78})`,
                opacity: visible ? (off === 0 ? 1 : 0.55) : 0,
                zIndex: 10 - Math.abs(off),
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <div
                className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border-4 border-card p-5 shadow-[var(--shadow-float)]"
                style={{ background: `linear-gradient(160deg, ${s.color}, color-mix(in oklab, ${s.color} 55%, black))` }}
              >
                <span className="absolute inset-y-0 right-0 w-3 bg-card/25" />
                <span className="text-7xl drop-shadow-lg">{s.icon}</span>
                <span className="font-display text-xl font-bold text-primary-foreground drop-shadow">{s.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex justify-center gap-1.5">
        {subjects.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.name}
            onClick={() => setIndex(i)}
            className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-primary/25")}
          />
        ))}
      </div>

      <p className="mb-4 text-center text-sm text-muted-foreground">
        {current.units.length} وحدات · {quizCount} اختبارات دروس
      </p>

      <div className="flex flex-col gap-3">
        <Link
          to="/quizzes/$subjectId"
          params={{ subjectId: current.id }}
          search={{ mode: "exam" }}
          className="press gradient-hero flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-card)]"
        >
          <Sparkles className="size-5" /> اختبر في هذه المادة
        </Link>
        <Link
          to="/quizzes/$subjectId"
          params={{ subjectId: current.id }}
          search={{ mode: "units" }}
          className="press flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-card py-4 text-base font-bold text-primary"
        >
          <ClipboardList className="size-5" /> اختبارات الوحدات
        </Link>
      </div>
    </Screen>
  );
}
