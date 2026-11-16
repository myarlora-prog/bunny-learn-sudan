import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { playAppSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

type Card = { q: string; a: string };
type Motion = "idle" | "dragging" | "leaving" | "entering";

export function LessonFlashcards({ cards, sound }: { cards: Card[]; sound: boolean }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [turning, setTurning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [motion, setMotion] = useState<Motion>("idle");
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const timers = useRef<number[]>([]);
  const card = cards[index];
  const busy = turning || motion === "leaving" || motion === "entering";

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  if (!card) return null;

  const flip = () => {
    if (busy) return;
    setTurning(true);
    setFlipped((value) => !value);
    playAppSound("flip", sound);
    timers.current.push(window.setTimeout(() => setTurning(false), 620));
  };

  const moveTo = (nextIndex: number, direction: number) => {
    if (busy) return;
    setFlipped(false);
    setMotion("leaving");
    setOffset(direction * Math.max(window.innerWidth, 360) * 1.1);
    timers.current.push(window.setTimeout(() => {
      setIndex((nextIndex + cards.length) % cards.length);
      setOffset(-direction * 90);
      setMotion("entering");
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setOffset(0)));
      timers.current.push(window.setTimeout(() => setMotion("idle"), 320));
    }, 300));
  };

  const next = (direction = -1) => moveTo(index + 1, direction);
  const previous = () => moveTo(index - 1, 1);

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const distance = event.clientX - drag.current.x;
    if (Math.abs(distance) > 5) {
      setMotion("dragging");
      setOffset(distance);
    }
  };
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const distance = event.clientX - drag.current.x;
    const vertical = event.clientY - drag.current.y;
    drag.current = null;
    if (Math.abs(distance) >= 60 && Math.abs(distance) > Math.abs(vertical)) {
      suppressClick.current = true;
      next(distance > 0 ? 1 : -1);
    } else {
      setMotion("idle");
      setOffset(0);
    }
  };
  const pointerCancel = () => {
    drag.current = null;
    setMotion("idle");
    setOffset(0);
  };

  return (
    <div>
      <div
        data-testid="flashcard-swipe-layer"
        className="study-card-scene"
        style={{
          transform: `translateX(${offset}px) rotate(${offset / 38}deg)`,
          opacity: motion === "leaving" ? 0.2 : 1,
          transition: motion === "dragging" || (motion === "entering" && offset !== 0)
            ? "none"
            : "transform 300ms cubic-bezier(.2,.75,.2,1), opacity 300ms ease",
          touchAction: "pan-y",
          willChange: "transform",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            flip();
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          disabled={busy}
          aria-label={flipped ? `الإجابة: ${card.a}. اضغط للعودة إلى السؤال` : `السؤال: ${card.q}. اضغط لإظهار الإجابة`}
          className="press block min-h-64 w-full text-center"
        >
          <span className={cn("study-card-inner", flipped && "is-flipped")}>
            <span className="study-card-face surface-card">
              <span className="text-[11px] font-bold text-primary">السؤال</span>
              <span className="text-lg font-bold leading-relaxed">{card.q}</span>
              <span className="text-[11px] text-muted-foreground">اضغط للقلب أو اسحب يمينًا ويسارًا للبطاقة التالية</span>
            </span>
            <span className="study-card-face study-card-back surface-card">
              <span className="text-[11px] font-bold text-success">الجواب</span>
              <span className="text-lg font-bold leading-relaxed">{card.a}</span>
              <span className="text-[11px] text-muted-foreground">اضغط للعودة إلى السؤال</span>
            </span>
          </span>
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" disabled={busy} onClick={previous} className="press rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-bold">السابق</button>
        <span className="text-sm text-muted-foreground" aria-live="polite">{index + 1} / {cards.length}</span>
        <button type="button" disabled={busy} onClick={() => next()} className="press gradient-hero rounded-2xl px-4 py-2.5 text-sm font-bold text-primary-foreground">التالي</button>
      </div>
    </div>
  );
}
