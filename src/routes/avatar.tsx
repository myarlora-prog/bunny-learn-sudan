import { createFileRoute } from "@tanstack/react-router";
import { Lock, Check } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { useApp } from "@/lib/app-state";
import { useRequireAuth } from "@/lib/guards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/avatar")({
  head: () => ({
    meta: [
      { title: "تخصيص الشخصية | سَقرو" },
      { name: "description", content: "اختر شخصيتك داخل سَقرو: وجوه وتعبيرات وإطلالات مختلفة لمشتركي السوبر." },
      { property: "og:title", content: "تخصيص الشخصية | سَقرو" },
      { property: "og:description", content: "خصّص شخصيتك داخل تطبيق سَقرو." },
    ],
  }),
  component: AvatarPage,
});

const GROUPS: { title: string; free: boolean; items: string[] }[] = [
  { title: "الشخصية الأساسية", free: true, items: ["🦅", "🙂", "😀"] },
  { title: "التعبيرات", free: false, items: ["😎", "🤓", "🤩", "😇", "🥳", "😴"] },
  { title: "إطلالات وشخصيات", free: false, items: ["🧑‍🎓", "👨‍🚀", "🦸", "🧙", "🥷", "👩‍🔬"] },
  { title: "حيوانات ورموز", free: false, items: ["🦁", "🐯", "🐼", "🐬", "🦉", "🐝"] },
];

function AvatarPage() {
  useRequireAuth();
  const { state, update, isSuper } = useApp();

  return (
    <Screen>
      <PageHeader title="تخصيص الشخصية" subtitle={isSuper ? "اختر ما يعجبك" : "الشخصية الأساسية مجانية"} back />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-primary-foreground/15 text-5xl">
          {state.avatar}
        </span>
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">{state.name || "طالب سَقرو"}</h2>
          <p className="text-xs text-primary-foreground/85">
            {isSuper ? "تخصيص كامل مفعّل ✨" : "اشترك في السوبر لفتح كل الشخصيات"}
          </p>
        </div>
      </Card>

      {GROUPS.map((g) => (
        <div key={g.title} className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-bold">{g.title}</h3>
            {!g.free && !isSuper && <Lock className="size-3.5 text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {g.items.map((emoji) => {
              const locked = !g.free && !isSuper;
              const active = state.avatar === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  disabled={locked}
                  onClick={() => update({ avatar: emoji })}
                  className={cn(
                    "press relative flex aspect-square items-center justify-center rounded-2xl border border-border bg-card text-2xl shadow-[var(--shadow-soft)]",
                    active && "border-primary bg-primary-soft",
                    locked && "opacity-40",
                  )}
                >
                  {emoji}
                  {active && (
                    <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Screen>
  );
}
