import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Infinity as InfinityIcon } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/** Small energy indicator used in screen headers. */
export function EnergyBadge({ className }: { className?: string }) {
  const { energy, isSuper } = useApp();
  const total = (energy?.daily_max ?? 5) + (energy?.regen_max ?? 3);
  return (
    <Link
      to="/super"
      className={cn(
        "flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <Zap className="size-4 text-warning" />
      {isSuper ? (
        <InfinityIcon className="size-4 text-primary" />
      ) : (
        <span className="text-sm font-bold">
          {energy?.available ?? 0}
          <span className="text-[11px] text-muted-foreground">/{total}</span>
        </span>
      )}
    </Link>
  );
}

function useCountdown(target: string | null | undefined) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!target) {
      setLeft("");
      return;
    }
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setLeft("00:00");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

/** Blocking modal shown to free students when energy hits zero. */
export function ZeroEnergyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { energy, isSuper, refreshEnergy } = useApp();
  const countdown = useCountdown(energy?.next_regen_at ?? null);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => void refreshEnergy(), 30000);
    return () => clearInterval(id);
  }, [open, refreshEnergy]);

  if (!open || isSuper) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-6 backdrop-blur-sm sm:items-center">
      <div className="page-enter w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-float)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-warning/15">
          <Zap className="size-7 text-warning" />
        </span>
        <h2 className="mt-3 text-xl">انتهت طاقتك</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          تُستهلك الطاقة عند الإجابة الخاطئة أو عند سؤال سَقرو AI. القراءة والملخصات والبطاقات مجانية دائمًا.
        </p>

        {countdown ? (
          <div className="mt-4 rounded-2xl bg-secondary px-4 py-3">
            <p className="text-[11px] text-muted-foreground">الطاقة القادمة بعد</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-primary">{countdown}</p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
            تعود طاقتك بالكامل مع بداية اليوم الجديد.
          </p>
        )}

        <Link
          to="/super"
          onClick={onClose}
          className="press gradient-hero mt-4 flex h-13 items-center justify-center rounded-3xl py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)]"
        >
          اشترك في السوبر
        </Link>
        <button type="button" onClick={onClose} className="mt-3 text-xs font-bold text-muted-foreground">
          إغلاق
        </button>
      </div>
    </div>
  );
}
