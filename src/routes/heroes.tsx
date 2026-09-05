import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Trophy, Lock } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { useHeroes } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";
import { useRequireAuth } from "@/lib/guards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/heroes")({
  head: () => ({
    meta: [
      { title: "أبطال Saqro 🏆 | لوحة الصدارة" },
      { name: "description", content: "تنافس مع طلاب صفك في سَقرو واصعد إلى قمة أبطال Saqro بالنقاط." },
      { property: "og:title", content: "أبطال Saqro 🏆" },
      { property: "og:description", content: "لوحة صدارة خاصة بصفك الدراسي." },
    ],
  }),
  component: HeroesPage,
});

const MEDALS = ["🥇", "🥈", "🥉"];

function HeroesPage() {
  const { session } = useRequireAuth();
  const { state, isSuper } = useApp();
  const { data, isLoading } = useHeroes(!!session);

  const list = data ?? [];
  const me = list.find((h) => h.user_id === session?.user.id);
  const visible = isSuper ? list : list.slice(0, 3);

  return (
    <Screen>
      <PageHeader title="أبطال Saqro 🏆" subtitle="الترتيب داخل صفك الدراسي" back />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <span className="flex size-14 items-center justify-center rounded-3xl bg-primary-foreground/15 text-2xl">
          {state.avatar || "🦅"}
        </span>
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">ترتيبك: {me ? `#${me.rank}` : "—"}</h2>
          <p className="text-xs text-primary-foreground/85">{state.points} نقطة</p>
        </div>
        <Trophy className="size-7 text-primary-foreground" />
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          اختر مرحلتك وصفك أولًا لتظهر لوحة الأبطال الخاصة بك.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {visible.map((h) => (
            <Card
              key={h.user_id}
              className={cn(
                "flex items-center gap-3 py-3.5",
                h.user_id === session?.user.id && "border-primary/40 bg-primary-soft/40",
              )}
            >
              <span className="w-7 text-center text-base font-bold text-muted-foreground">
                {MEDALS[h.rank - 1] ?? h.rank}
              </span>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-lg">
                {h.avatar_emoji || "🦅"}
              </span>
              <h3 className="flex-1 truncate text-sm font-bold">{h.display_name}</h3>
              <span className="text-sm font-bold text-primary">{h.points}</span>
            </Card>
          ))}
        </div>
      )}

      {!isSuper && list.length > 3 && (
        <Card className="mt-3 flex items-center gap-3">
          <Lock className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">المنافسة الكاملة للسوبر</h3>
            <p className="text-[11px] text-muted-foreground">
              نقاطك تُحتسب دائمًا، ومشتركو السوبر يرون الترتيب الكامل لصفهم.
            </p>
          </div>
          <Link to="/super" className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
            السوبر
          </Link>
        </Card>
      )}
    </Screen>
  );
}
