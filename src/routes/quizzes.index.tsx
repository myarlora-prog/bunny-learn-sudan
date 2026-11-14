import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Loader2, Sparkles } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { Screen } from "@/components/app-shell";
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
    return <Screen><Loader2 className="mx-auto my-10 size-6 animate-spin text-primary" /></Screen>;
  }
  if (n === 0) {
    return <Screen><SaqroEmpty title="لا توجد مواد منشورة بعد" desc="ستظهر اختبارات صفك هنا فور نشرها." /></Screen>;
  }

  const safeIndex = Math.min(index, n - 1);
  const go = (d: number) => setIndex((i) => (i + d + n) % n);
  const current = subjects[safeIndex];
  if (!current) return null;

  return (
    <Screen>
      <div
        className="relative mx-auto mt-4 h-[340px] select-none overflow-hidden [perspective:1000px]"
        onTouchStart={(e) => (startX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const end = e.changedTouches[0];
          if (!end) return;
          const dx = end.clientX - startX.current;
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
                transform: `translateX(calc(-50% + ${-off * 150}px)) rotateY(${off * 20}deg) scale(${off === 0 ? 1 : 0.82})`,
                opacity: visible ? (off === 0 ? 1 : 0.66) : 0,
                zIndex: 10 - Math.abs(off),
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <div
                className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[18px] p-5 text-on-colored"
                style={{
                  background: `linear-gradient(150deg, color-mix(in oklab, ${s.color} 88%, var(--card)), color-mix(in oklab, ${s.color} 76%, var(--background)))`,
                  boxShadow: `0 30px 50px -24px color-mix(in oklab, ${s.color} 65%, transparent)`,
                  maskImage: "linear-gradient(to left, transparent, black 6%, black 94%, transparent)",
                }}
              >
                <span className="absolute inset-y-0 right-5 w-px" style={{ background: `linear-gradient(transparent, color-mix(in oklab, ${s.color} 35%, var(--on-colored)), transparent)` }} />
                <Sparkles className="relative size-7 text-on-colored/90" />
                <span className="relative self-start text-5xl drop-shadow">{s.icon}</span>
                <span className="relative font-display text-2xl font-bold text-on-colored drop-shadow">{s.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex justify-center gap-1.5">
        {subjects.map((s, i) => (
          <button key={s.id} type="button" aria-label={s.name} onClick={() => setIndex(i)} className={cn("h-2 rounded-full transition-all", i === safeIndex ? "w-6" : "w-2 opacity-30")} style={{ background: s.color }} />
        ))}
      </div>

      <div style={{ "--subject-color": current.color } as CSSProperties}>
        <p className="mb-4 text-center text-sm font-bold" style={{ color: current.color }}>{current.name}</p>
        <div className="flex flex-col gap-3">
          <Link
            to="/quizzes/$subjectId"
            params={{ subjectId: current.id }}
            search={{ mode: "exam" }}
            className="press flex items-center justify-center gap-2 rounded-[22px] border-b-4 py-4 text-base font-bold text-on-colored"
            style={{ background: current.color, borderColor: `color-mix(in oklab, ${current.color} 70%, var(--foreground))`, boxShadow: `0 14px 34px -18px color-mix(in oklab, ${current.color} 70%, transparent)` }}
          >
            <Sparkles className="size-5" /> اختبر في هذه المادة
          </Link>
          <Link
            to="/quizzes/$subjectId"
            params={{ subjectId: current.id }}
            search={{ mode: "units" }}
            className="press flex items-center justify-center gap-2 rounded-[22px] border-b-4 bg-card py-4 text-base font-bold shadow-[var(--shadow-soft)]"
            style={{ color: current.color, borderColor: `color-mix(in oklab, ${current.color} 32%, var(--border))` }}
          >
            <ClipboardList className="size-5" /> اختبارات الوحدات
          </Link>
        </div>
      </div>
    </Screen>
  );
}
