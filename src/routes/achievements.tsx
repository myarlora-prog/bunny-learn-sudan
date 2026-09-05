import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { achievements } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "الإنجازات والمكافآت | سَقرو" },
      { name: "description", content: "اجمع الأوسمة والنقاط كلما أكملت دروسك والتزمت بخطتك الدراسية مع سَقرو." },
      { property: "og:title", content: "الإنجازات والمكافآت | سَقرو" },
      { property: "og:description", content: "أوسمة تحفّزك على الاستمرار في المذاكرة كل يوم." },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { state } = useApp();
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <Screen>
      <PageHeader title="إنجازاتي" subtitle={`${earned} من ${achievements.length} أوسمة`} back />

      <Card className="gradient-hero flex items-center gap-3 border-transparent">
        <Saqro size={70} float />
        <div className="flex-1 text-primary-foreground">
          <p className="text-xs text-primary-foreground/85">رصيد نقاطك</p>
          <h2 className="text-2xl text-primary-foreground">{state.points}</h2>
          <p className="text-xs text-primary-foreground/85">استمر! كل درس يمنحك ٢٥ نقطة</p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {achievements.map((a) => (
          <Card key={a.id} className={cn("text-center", !a.earned && "opacity-60")}>
            <div className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">
              {a.earned ? a.icon : <Lock className="size-5 text-muted-foreground" />}
            </div>
            <h3 className="mt-3 text-sm font-bold">{a.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.desc}</p>
            <p className={cn("mt-2 text-[11px] font-bold", a.earned ? "text-success" : "text-muted-foreground")}>
              {a.earned ? "تم الحصول عليه" : "مقفل"}
            </p>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
