import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { playAppSound } from "@/lib/sound";
import { activeTourSteps, fetchTourSteps, type TourStep } from "@/lib/tour-steps";

type Rect = { top: number; left: number; width: number; height: number };

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const query = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);

async function waitFor(target: string, timeout = 5000): Promise<HTMLElement | null> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const el = query(target);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await sleep(120);
  }
  return null;
}

export function StudentTour() {
  const { session, state, hydrated, update } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const dir = useRef(1);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const eligible = Boolean(session && hydrated && state.gradeId && state.tutorialCompletedAt === null && pathname === "/curriculum");

  useEffect(() => {
    if (eligible && !active) {
      fetchTourSteps()
        .then((rows) => {
          const list = activeTourSteps(rows);
          if (!list.length) return;
          setSteps(list);
          setIndex(0);
          dir.current = 1;
          setActive(true);
        })
        .catch(() => undefined);
    }
    if (!session && active) setActive(false);
  }, [eligible, active, session]);

  const finish = useCallback(() => {
    update({ tutorialCompletedAt: new Date().toISOString() });
    setActive(false);
    setRect(null);
  }, [update]);

  const goHref = useCallback(async (href: string | null) => {
    if (!href) return false;
    await router.navigate({ href });
    return true;
  }, [router]);

  /** Navigate to the page a step lives on. Returns false if unreachable. */
  const ensurePage = useCallback(async (page: string): Promise<boolean> => {
    const path = () => pathRef.current;
    if (page.startsWith("/")) {
      if (path() !== page) await navigate({ to: page as "/curriculum" });
      return true;
    }
    if (page === "subject") {
      if (/^\/curriculum\/[^/]+$/.test(path())) return true;
      await ensurePage("/curriculum");
      const a = await waitFor("library-subject-first");
      return goHref(a?.getAttribute("href") ?? null);
    }
    if (page === "lesson") {
      if (path().startsWith("/lesson/")) return true;
      if (!(await ensurePage("subject"))) return false;
      const a = await waitFor("subject-lesson-first");
      return goHref(a?.getAttribute("href") ?? null);
    }
    return false;
  }, [navigate, goHref]);

  const step = active && steps ? steps[index] : undefined;

  // Arrive at the step's page and wait for its real element before showing it.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    setReady(false);
    setRect(null);
    void (async () => {
      const ok = await ensurePage(step.page);
      const el = ok ? await waitFor(step.target_id) : null;
      if (cancelled) return;
      if (!el) {
        // Element unavailable: skip safely instead of pointing at the wrong place.
        const nextIndex = index + dir.current;
        if (nextIndex < 0 || nextIndex >= (steps?.length ?? 0)) finish();
        else setIndex(nextIndex);
        return;
      }
      if (!step.target_id.endsWith("-nav")) el.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(step.target_id.endsWith("-nav") ? 60 : 450);
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [step, index, steps, ensurePage, finish]);

  // Track target position continuously (layout shifts, resize, scroll).
  useEffect(() => {
    if (!step || !ready) return;
    let frame = 0;
    const tick = () => {
      const el = query(step.target_id);
      if (el) {
        const b = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === b.top && prev.left === b.left && prev.width === b.width && prev.height === b.height
            ? prev
            : { top: b.top, left: b.left, width: b.width, height: b.height },
        );
      } else setRect(null);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [step, ready]);

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);

  if (!active || !steps || !step) return null;
  const total = steps.length;

  const next = () => {
    playAppSound("button", state.sound);
    dir.current = 1;
    if (index === total - 1) finish();
    else setIndex(index + 1);
  };
  const previous = () => {
    if (index === 0) return;
    playAppSound("button", state.sound);
    dir.current = -1;
    setIndex(index - 1);
  };
  const skip = () => {
    playAppSound("button", state.sound);
    finish();
  };

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const pad = 6;
  const hl = rect && ready
    ? {
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: Math.min(vw - 8, rect.width + pad * 2),
        height: Math.min(vh - 8, rect.height + pad * 2),
      }
    : null;
  const below = hl ? hl.top + hl.height / 2 < vh / 2 : false;
  const cardStyle: CSSProperties = hl
    ? below
      ? { top: Math.min(vh - 260, hl.top + hl.height + 16) }
      : { bottom: Math.max(16, vh - hl.top + 16) }
    : { top: "30%" };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="جولة التعريف بنوابغ" dir="rtl">
      {!hl && <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />}
      {hl && <div className="tour-highlight pointer-events-none fixed rounded-3xl border-2 border-primary" style={hl} />}
      {ready && (
        <section
          key={step.id}
          className="surface-card rise fixed inset-x-4 z-[83] mx-auto max-w-md p-5 shadow-[var(--shadow-float)]"
          style={cardStyle}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-primary">{index + 1} من {total}</p>
              <h2 className="mt-1 text-xl">{step.title}</h2>
            </div>
            <button type="button" onClick={skip} className="press flex size-9 items-center justify-center rounded-xl bg-secondary" aria-label="تخطي الجولة">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="gradient-hero h-full rounded-full transition-all duration-500" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={previous} className="press flex h-11 items-center justify-center gap-1 rounded-2xl border border-border px-4 text-sm font-bold">
                <ArrowRight className="size-4" /> السابق
              </button>
            )}
            <button type="button" onClick={skip} className="press h-11 rounded-2xl px-4 text-sm font-bold text-muted-foreground">تخطي</button>
            <button type="button" onClick={next} className="press gradient-hero flex h-11 flex-1 items-center justify-center gap-1 rounded-2xl px-5 text-sm font-bold text-primary-foreground">
              {index === total - 1 ? <Check className="size-4" /> : <ArrowLeft className="size-4" />}
              {index === total - 1 ? "إنهاء" : "التالي"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
