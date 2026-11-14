import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Saqro } from "@/components/saqro";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نوابغ | تطبيق المنهج السوداني الذكي" },
      {
        name: "description",
        content: "نوابغ تطبيق تعليمي ذكي للمنهج السوداني: ملخصات وبطاقات واختبارات ومساعد ذكي يرافقك في مذاكرتك.",
      },
      { property: "og:title", content: "نوابغ | تطبيق المنهج السوداني الذكي" },
      { property: "og:description", content: "ملخصات ذكية وبطاقات واختبارات ومساعد نوابغ الذكي للمنهج السوداني." },
    ],
  }),
  component: Onboarding,
});

const slides = [
  {
    title: "أهلاً بك، أنا نوابغ 👋",
    desc: "رفيقك في المذاكرة. سنتعلّم المنهج السوداني خطوة بخطوة، بهدوء وبدون تشتيت.",
    variant: "wave" as const,
  },
  {
    title: "ملخصات وبطاقات ذكية",
    desc: "كل درس مع ملخص مركّز وبطاقات مراجعة سريعة تثبّت المعلومة في ذاكرتك.",
    variant: "study" as const,
  },
  {
    title: "اختبارات ومساعد ذكي",
    desc: "اختبارات مولّدة بالذكاء الاصطناعي، ومساعد نوابغ يجيب على أسئلتك في أي وقت.",
    variant: "wave" as const,
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const slide = slides[i]!;
  const last = i === slides.length - 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 pb-10 pt-12">
      <div className="flex justify-end">
        <Link to="/auth" className="text-sm font-medium text-muted-foreground">
          تخطّي
        </Link>
      </div>

      <div key={i} className="page-enter flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute size-56 rounded-full bg-primary-soft blur-2xl" />
          <Saqro variant={slide.variant} size={220} float priority />
        </div>
        <h1 className="text-3xl leading-tight">{slide.title}</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{slide.desc}</p>
      </div>

      <div className="mb-8 flex justify-center gap-2">
        {slides.map((_, idx) => (
          <span
            key={idx}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              idx === i ? "w-7 bg-primary" : "w-2 bg-border",
            )}
          />
        ))}
      </div>

      {last ? (
        <Link
          to="/auth"
          className="press gradient-hero flex h-16 items-center justify-center rounded-3xl text-lg font-bold text-primary-foreground shadow-[var(--shadow-float)] outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          هيا نبدأ
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setI(i + 1)}
          className="press gradient-hero h-16 rounded-3xl text-lg font-bold text-primary-foreground shadow-[var(--shadow-float)] outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          التالي
        </button>
      )}
    </div>
  );
}
