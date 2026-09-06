import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { EnergyBadge, ZeroEnergyModal } from "@/components/energy";
import { askSaqro } from "@/lib/ai.functions";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/saqro")({
  head: () => ({
    meta: [
      { title: "سَقرو AI | المساعد الدراسي الذكي" },
      { name: "description", content: "اسأل سَقرو الذكي عن أي درس: شرح مبسّط، تلخيص، أمثلة، أو اختبار سريع." },
      { property: "og:title", content: "سَقرو AI | المساعد الدراسي الذكي" },
      { property: "og:description", content: "مساعد دراسي ذكي يجيبك بلغة بسيطة في أي وقت." },
    ],
  }),
  component: SaqroAI,
});

type Msg = { role: "assistant" | "user"; content: string };

const suggestions = ["اشرح لي الدرس ببساطة", "لخّص لي أهم النقاط", "أعطني مثالًا محلولًا", "كيف أنظّم مذاكرتي اليوم؟"];

const superTools = [
  "اختبرني",
  "أسئلة إضافية",
  "أسئلة أصعب",
  "تدريب مخصص",
  "اشرح لي أخطائي",
  "درّبني على نقاط الضعف",
];

function SaqroAI() {
  const { session, isSuper, spendEnergy, energy } = useApp();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "أهلاً 👋 أنا سَقرو، مساعدك الدراسي. اسألني عن أي درس في منهجك وسأشرحه لك ببساطة.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    if (!session) {
      setMessages((m) => [...m, { role: "assistant", content: "سجّل دخولك أولًا لتتمكن من سؤال سَقرو." }]);
      return;
    }
    if (!isSuper) {
      const res = await spendEnergy(1);
      if (!res.ok) {
        setBlocked(true);
        return;
      }
    }
    const history = messages.filter((m, i) => i > 0).slice(-10);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setTyping(true);
    try {
      const res = await askSaqro({ data: { message: q, history } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "حدث خطأ في الاتصال، حاول مرة أخرى." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <Screen>
      <div className="mb-4 flex items-center gap-3">
        <Saqro size={64} float priority />
        <div className="flex-1">
          <h1 className="text-xl">سَقرو الذكي</h1>
          <p className="text-xs text-success">متصل الآن · جاهز لمساعدتك</p>
        </div>
        <EnergyBadge />
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "rise max-w-[82%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-soft)]",
                m.role === "user"
                  ? "gradient-hero rounded-tr-lg text-primary-foreground"
                  : "rounded-tl-lg border border-border bg-card",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-end">
            <div className="flex gap-1 rounded-3xl border border-border bg-card px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-2 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isSuper && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-primary">
            <Sparkles className="size-3.5" /> تدريب سوبر
          </p>
          <div className="flex flex-wrap gap-2">
            {superTools.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="press gradient-hero rounded-2xl px-3 py-2 text-[11px] font-bold text-primary-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="press rounded-2xl border border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {!isSuper && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          كل سؤال يستهلك نقطة طاقة واحدة · لديك {energy?.available ?? 0}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-lg px-5"
      >
        <div className="glass-panel flex items-center gap-2 rounded-3xl p-2 shadow-[var(--shadow-float)]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك لسَقرو..."
            className="h-11 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="إرسال"
            className="press gradient-hero flex size-11 items-center justify-center rounded-2xl text-primary-foreground"
          >
            <Send className="size-5 rotate-180" />
          </button>
        </div>
      </form>

      <ZeroEnergyModal open={blocked} onClose={() => setBlocked(false)} />
    </Screen>
  );
}
