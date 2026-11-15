import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { playAppSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

type TourPath = "/curriculum" | "/quizzes" | "/streak" | "/profile" | "/super";
type Rect = { top: number; left: number; width: number; height: number };
type Step = { path: TourPath; target?: string; fallback?: string; title: string; body: string };

const steps: Step[] = [
  {
    path: "/curriculum",
    title: "أهلًا بك في نوابغ 👋",
    body: "جولة قصيرة داخل التطبيق الحقيقي ستعرّفك على المكتبة والاختبارات والتقدم وحسابك. يمكنك التخطي في أي وقت.",
  },
  {
    path: "/curriculum",
    target: "curriculum-nav",
    title: "المكتبة",
    body: "من هنا تصل إلى مواد صفك. افتح المادة، ثم تصفّح الوحدات واختر الدرس الذي تريد مذاكرته.",
  },
  {
    path: "/curriculum",
    target: "library-subjects",
    fallback: "curriculum-nav",
    title: "المواد والدروس",
    body: "كل بطاقة تمثل مادة. داخل الدرس تجد الشرح والملخص؛ اقرأ بالترتيب الذي يناسبك وراجع النقاط المهمة.",
  },
  {
    path: "/curriculum",
    target: "library-subjects",
    fallback: "curriculum-nav",
    title: "البطاقات التعليمية",
    body: "افتح تبويب «البطاقات» داخل الدرس. السؤال على الوجه الأمامي؛ اضغط البطاقة لتنقلب وترى الإجابة، ثم اضغطها للعودة.",
  },
  {
    path: "/quizzes",
    target: "quizzes-nav",
    title: "اختباراتي",
    body: "هنا تجد اختبارات موادك واختبارات الوحدات المنشورة لك.",
  },
  {
    path: "/quizzes",
    target: "quiz-carousel",
    fallback: "quizzes-nav",
    title: "اختر مادتك وابدأ",
    body: "اسحب بطاقات الكتب يمينًا أو يسارًا لاختيار المادة، ثم افتح الاختبار. اختر إجابتك وستظهر النتيجة الصحيحة والخطأ بوضوح، وتظهر نتيجتك في النهاية.",
  },
  {
    path: "/streak",
    target: "streak-nav",
    title: "التقدم والاستريك 🔥",
    body: "فتح درس يسجّل يوم مذاكرة واحدًا، حتى لو فتحت دروسًا كثيرة في اليوم نفسه. المذاكرة في أيام متتابعة تزيد استريكك.",
  },
  {
    path: "/streak",
    target: "streak-current",
    title: "اقرأ نشاطك",
    body: "الرقم الحالي يوضح تتابعك الآن، وأعلى استريك يحفظ أفضل إنجاز لك. إذا فاتك يوم كامل يبدأ التتابع الحالي من جديد عند عودتك، وتساعدك العلامات البرتقالية على قراءة أيام نشاطك.",
  },
  {
    path: "/curriculum",
    target: "weekly-activity",
    title: "نشاط الأسبوع",
    body: "تعرض هذه البطاقة أيام الأسبوع وعدد مرات فتح الدروس والاختبارات. الدوائر البرتقالية تمثل أيام المذاكرة المسجلة فعلًا.",
  },
  {
    path: "/profile",
    target: "profile-nav",
    title: "حسابي",
    body: "من هنا ترى بياناتك الدراسية وتصل إلى دعوات الأصدقاء والإعدادات والدعم.",
  },
  {
    path: "/profile",
    target: "profile-options",
    title: "خصّص تجربتك",
    body: "في الإعدادات اختر المظهر الداكن أو الفاتح أو التلقائي وتحكّم بالصوت. ومن «إرسال ملاحظة» أرسل اقتراحك، ومن «دعوة الأصدقاء» انسخ كودك وتابع تقدمك.",
  },
  {
    path: "/super",
    target: "unlock-help",
    title: "فتح جميع الدروس 💎",
    body: "الماسة تعني أن جميع دروس صفك متاحة حاليًا. للاستفسار عن فتحها اختر دولتك وتواصل مع فريق نوابغ عبر واتساب من هذه الصفحة.",
  },
  {
    path: "/curriculum",
    title: "أنت جاهز للبدء 🎉",
    body: "ابدأ بدرس قصير اليوم لتسجيل أول يوم مذاكرة. يمكنك إعادة هذه الجولة لاحقًا من صفحة «حسابي».",
  },
];

export function StudentTour() {
  const { session, state, hydrated, update } = useApp();
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index]!;

  const eligible = Boolean(session && hydrated && state.gradeId && state.tutorialCompletedAt === null && pathname === "/curriculum");

  useEffect(() => {
    if (eligible && !active) {
      setIndex(0);
      setActive(true);
    }
    if (!session && active) setActive(false);
  }, [eligible, active, session]);

  useEffect(() => {
    if (!active || pathname === step.path) return;
    void navigate({ to: step.path });
  }, [active, pathname, step.path, navigate]);

  const measure = useCallback(() => {
    if (!active || !step.target) {
      setRect(null);
      return;
    }
    const element = document.querySelector(`[data-tour="${step.target}"]`)
      ?? (step.fallback ? document.querySelector(`[data-tour="${step.fallback}"]`) : null);
    if (!element) {
      setRect(null);
      return;
    }
    if (!step.target.endsWith("-nav")) element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const box = element.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    }, step.target.endsWith("-nav") ? 30 : 360);
  }, [active, step.target, step.fallback]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [active, index, pathname, measure]);

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);

  if (!active) return null;

  const close = () => {
    playAppSound("button", state.sound);
    update({ tutorialCompletedAt: new Date().toISOString() });
    setActive(false);
  };
  const next = () => {
    playAppSound("button", state.sound);
    if (index === steps.length - 1) {
      update({ tutorialCompletedAt: new Date().toISOString() });
      setActive(false);
    } else {
      setRect(null);
      setIndex((value) => value + 1);
    }
  };
  const previous = () => {
    if (index === 0) return;
    playAppSound("button", state.sound);
    setRect(null);
    setIndex((value) => value - 1);
  };

  const isNavTarget = step.target?.endsWith("-nav") ?? false;
  const cardBelowTarget = rect ? rect.top + rect.height < window.innerHeight * 0.48 : false;
  const cardStyle: CSSProperties = rect
    ? cardBelowTarget
      ? { top: Math.min(window.innerHeight - 300, rect.top + rect.height + 28) }
      : { bottom: isNavTarget ? 108 : 24 }
    : { top: "50%", transform: "translateY(-50%)" };
  const highlightStyle: CSSProperties | undefined = rect
    ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }
    : undefined;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="جولة التعريف بنوابغ">
      {!rect && <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />}
      {rect && (
        <>
          <div className="tour-highlight pointer-events-none fixed rounded-3xl border-2 border-primary" style={highlightStyle} />
          <span
            className="pointer-events-none fixed z-[82] -translate-x-1/2 text-3xl font-bold text-primary"
            style={{ left: rect.left + rect.width / 2, top: cardBelowTarget ? rect.top + rect.height + 3 : rect.top - 34 }}
            aria-hidden
          >
            {cardBelowTarget ? "↓" : "↑"}
          </span>
        </>
      )}
      <section className="surface-card fixed inset-x-4 z-[83] mx-auto max-w-md p-5 shadow-[var(--shadow-float)]" style={cardStyle}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-primary">جولة نوابغ · {index + 1} / {steps.length}</p>
            <h2 className="mt-1 text-xl">{step.title}</h2>
          </div>
          <button type="button" onClick={close} className="press flex size-9 items-center justify-center rounded-xl bg-secondary" aria-label="تخطي الجولة">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
        <div className="mt-5 flex items-center gap-2">
          {index > 0 && (
            <button type="button" onClick={previous} className="press flex h-11 items-center justify-center gap-1 rounded-2xl border border-border px-4 text-sm font-bold">
              <ArrowRight className="size-4" /> السابق
            </button>
          )}
          <button type="button" onClick={close} className="press h-11 rounded-2xl px-4 text-sm font-bold text-muted-foreground">تخطي</button>
          <button type="button" onClick={next} className={cn("press gradient-hero flex h-11 flex-1 items-center justify-center gap-1 rounded-2xl px-5 text-sm font-bold text-primary-foreground")}>
            {index === steps.length - 1 ? <Check className="size-4" /> : <ArrowLeft className="size-4" />}
            {index === 0 ? "ابدأ الجولة" : index === steps.length - 1 ? "إنهاء" : "التالي"}
          </button>
        </div>
      </section>
    </div>
  );
}
