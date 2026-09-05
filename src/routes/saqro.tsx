import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import { Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
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

type Msg = { role: "saqro" | "me"; text: string };

const suggestions = [
  "اشرح لي نظرية فيثاغورس ببساطة",
  "لخّص لي درس كان وأخواتها",
  "اختبرني في السرعة والتسارع",
  "كيف أنظّم مذاكرتي اليوم؟",
];

const replies: Record<string, string> = {
  default:
    "سؤال ممتاز! دعني أبسّطها لك: ابدأ بفهم الفكرة الأساسية أولًا، ثم طبّق مثالًا واحدًا بنفسك، وأخيرًا راجع البطاقات التعليمية الخاصة بالدرس. جرّب أن تشرح الفكرة بصوتك — هذه أسرع طريقة لتثبيتها.",
};

function SaqroAI() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "saqro", text: "أهلاً 👋 أنا سَقرو، مساعدك الدراسي. اسألني عن أي درس في منهجك وسأشرحه لك ببساطة." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "me", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "saqro", text: replies["default"]! }]);
    }, 900);
  };

  return (
    <Screen>
      <div className="mb-4 flex items-center gap-3">
        <Saqro size={64} float priority />
        <div>
          <h1 className="text-xl">سَقرو الذكي</h1>
          <p className="text-xs text-success">متصل الآن · جاهز لمساعدتك</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "me" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "rise max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-soft)]",
                m.role === "me"
                  ? "gradient-hero rounded-tr-lg text-primary-foreground"
                  : "rounded-tl-lg border border-border bg-card",
              )}
            >
              {m.text}
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

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="press rounded-2xl border border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
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
    </Screen>
  );
}
