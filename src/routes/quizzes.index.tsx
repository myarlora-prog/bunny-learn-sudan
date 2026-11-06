import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader, Screen } from "@/components/app-shell";
import { SaqroEmpty } from "@/components/saqro";
import { useApp } from "@/lib/app-state";
import { useSubjects } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quizzes/")({
  head: () => ({
    meta: [
      { title: "اختباراتي | نوابغ" },
      { name: "description", content: "اختر مادتك وابدأ اختبارًا شاملًا أو اختبارات الوحدات في نوابغ." },
      { property: "og:title", content: "اختباراتي | نوابغ" },
      { property: "og:description", content: "اختبارات المواد والوحدات للمنهج السوداني مع نوابغ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizzesPage,
});

function QuizzesPage() {
  const { state } = useApp();
  const subjectsQ = useSubjects(state.gradeId);
  const subjects = subjectsQ.data ?? [];
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const n = subjects.length;

  if (subjectsQ.isLoading) {
    return (
      <Screen>
        <PageHeader title="اختباراتي" subtitle="اختر المادة واختبر نفسك" />
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" />
      </Screen>
    );
  }
  if (n === 0) {
    return (
      <Screen>
        <PageHeader title="اختباراتي" subtitle="اختر المادة واختبر نفسك" />
        <SaqroEmpty title="لا توجد مواد منشورة بعد" desc="ستظهر اختبارات صفك هنا فور نشرها." />
      </Screen>
    );
  }

  const safeIndex = Math.min(index, n - 1);
  const go = (d: number) => setIndex((i) => (i + d + n) % n);
  const current = subjects[safeIndex]!;

  return (
    <Screen>
      <PageHeader title="اختباراتي" subtitle="اختر المادة واختبر نفسك" />

      <div
        className="relative mx-auto mt-4 h-[340px] select-none overflow-hidden [perspective:1000px]"
        onTouchStart={(e) => (startX.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0]!.clientX - startX.current;
          if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        {subjects.map((s, i) => {
          let off = i - safeIndex;
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
                className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[18px] p-5 shadow-[0_30px_50px_-24px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
                style={{ background: `linear-gradient(150deg, color-mix(in oklab, ${s.color} 62%, white), ${s.color} 55%)` }}
              >
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,color-mix(in_oklab,white_30%,transparent)_0%,transparent_45%)]" />
                <span className="absolute inset-y-0 right-5 w-px bg-card/40" />
                <span className="absolute inset-y-2 -left-1 w-1.5 rounded bg-[repeating-linear-gradient(0deg,var(--border)_0_2px,transparent_2px_4px)]" />
                <Sparkles className="relative size-7 text-primary-foreground/90" />
                <span className="relative self-start text-5xl drop-shadow">{s.icon}</span>
                <span className="relative font-display text-2xl font-bold text-primary-foreground drop-shadow">{s.name}</span>
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
            className={cn("h-2 rounded-full transition-all", i === safeIndex ? "w-6 bg-primary" : "w-2 bg-primary/25")}
          />
        ))}
      </div>

      <p className="mb-4 text-center text-sm text-muted-foreground">{current.name}</p>

      <div className="flex flex-col gap-3">
        <Link
          to="/quizzes/$subjectId"
          params={{ subjectId: current.id }}
          search={{ mode: "exam" }}
          className="press flex items-center justify-center gap-2 rounded-[22px] border-b-4 border-primary/70 bg-primary py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-card)]"
        >
          <Sparkles className="size-5" /> اختبر في هذه المادة
        </Link>
        <Link
          to="/quizzes/$subjectId"
          params={{ subjectId: current.id }}
          search={{ mode: "units" }}
          className="press flex items-center justify-center gap-2 rounded-[22px] border-b-4 border-border bg-card py-4 text-base font-bold text-primary shadow-[var(--shadow-soft)]"
        >
          <ClipboardList className="size-5" /> اختبارات الوحدات
        </Link>
      </div>
    </Screen>
  );
}
