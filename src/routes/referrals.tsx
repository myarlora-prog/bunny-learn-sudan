import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Gift, Share2, Loader2 } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { useReferralSummary } from "@/lib/account-db";
import { useRequireAuth } from "@/lib/guards";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "دعوة الأصدقاء | سَقرو" },
      { name: "description", content: "ادعُ أصدقاءك إلى سَقرو واحصل على 14 يومًا سوبر مجانًا عند 10 دعوات ناجحة." },
      { property: "og:title", content: "دعوة الأصدقاء | سَقرو" },
      { property: "og:description", content: "شارك كودك واربح اشتراك سوبر مجاني." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { session } = useRequireAuth();
  const { data, isLoading } = useReferralSummary(!!session);
  const [copied, setCopied] = useState(false);

  const code = data?.code ?? "";
  const goal = data?.goal ?? 10;
  const count = data?.count ?? 0;
  const remaining = Math.max(goal - count, 0);
  const percent = Math.min(100, Math.round((count / goal) * 100));

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    const text = `انضم معي إلى تطبيق سَقرو 🦅 للمنهج السوداني واستخدم كودي: ${code}`;
    if (navigator.share) await navigator.share({ text }).catch(() => undefined);
    else await copy();
  };

  return (
    <Screen>
      <PageHeader title="دعوة الأصدقاء 🎁" subtitle="١٠ دعوات ناجحة = ١٤ يومًا سوبر مجانًا" back />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card className="gradient-hero border-transparent text-center">
            <p className="text-xs text-primary-foreground/85">كود الدعوة الخاص بك</p>
            <p className="mt-2 text-2xl font-bold tracking-widest text-primary-foreground">{code}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-card text-sm font-bold text-primary"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "تم النسخ" : "نسخ الكود"}
              </button>
              <button
                type="button"
                onClick={share}
                className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-foreground/15 text-sm font-bold text-primary-foreground"
              >
                <Share2 className="size-4" /> مشاركة
              </button>
            </div>
          </Card>

          <Card className="mt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">تقدمك نحو المكافأة</h3>
              <span className="text-sm font-bold text-primary">
                {count} / {goal}
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {data?.reward_granted
                ? "🎉 حصلت على مكافأة السوبر بالفعل"
                : `باقي ${remaining} ${remaining === 1 ? "دعوة" : "دعوات"} للحصول على ١٤ يومًا سوبر`}
            </p>
          </Card>

          <section className="mt-5">
            <h2 className="mb-3 text-lg">أصدقاؤك</h2>
            {data?.friends?.length ? (
              <div className="flex flex-col gap-2.5">
                {data.friends.map((f, i) => (
                  <Card key={`${f.name}-${i}`} className="flex items-center gap-3 py-3.5">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-lg">🦅</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold">{f.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(f.date).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    <span
                      className={
                        f.status === "active"
                          ? "rounded-xl bg-success/15 px-2.5 py-1 text-[10px] font-bold text-success"
                          : "rounded-xl bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground"
                      }
                    >
                      {f.status === "active" ? "مفعّلة" : "بانتظار النشاط"}
                    </span>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="flex items-center gap-3">
                <Gift className="size-5 text-primary" />
                <p className="text-xs text-muted-foreground">
                  لم تنضم أي دعوة بعد. شارك كودك مع أصدقائك وابدأ العدّ.
                </p>
              </Card>
            )}
          </section>
        </>
      )}
    </Screen>
  );
}
