import { createFileRoute } from "@tanstack/react-router";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { useSetting } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "سَقرو سوبر | الاشتراك المميز" },
      { name: "description", content: "اشترك في سَقرو سوبر: طاقة غير محدودة، شرح أعمق، بطاقات وأسئلة أكثر، ومنافسة أبطال Saqro." },
      { property: "og:title", content: "سَقرو سوبر | الاشتراك المميز" },
      { property: "og:description", content: "طاقة غير محدودة وشرح أعمق مع سَقرو سوبر." },
    ],
  }),
  component: SuperPage,
});

const FEATURES = [
  "طاقة غير محدودة — بدون انتظار",
  "شرح أعمق وملخصات أشمل لكل درس",
  "بطاقات مراجعة وأسئلة اختبار أكثر",
  "سَقرو AI بلا حدود وتدريب متقدم",
  "تخصيص كامل لشخصيتك",
  "منافسة أبطال Saqro 🏆 كاملة",
];

function fmt(date: string) {
  return new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function SuperPage() {
  const { subscription, isSuper } = useApp();
  const { data: link } = useSetting("whatsapp_link");
  const whatsapp = link || "https://wa.me/966557110297";

  return (
    <Screen>
      <PageHeader title="سَقرو سوبر" subtitle="افتح تجربة التعلّم الكاملة" back />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <Saqro size={78} float priority />
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">
            {isSuper ? "أنت مشترك في السوبر 🎉" : "الخطة المجانية"}
          </h2>
          <p className="mt-1 text-xs text-primary-foreground/85">
            {isSuper && subscription
              ? `ينتهي في ${fmt(subscription.expires_at)}`
              : "طاقة محدودة، شرح وملخصات مختصرة"}
          </p>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2.5">
        {FEATURES.map((f) => (
          <Card key={f} className="flex items-center gap-3 py-3.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary-soft">
              <Check className="size-4 text-primary" />
            </span>
            <p className="flex-1 text-sm font-bold">{f}</p>
          </Card>
        ))}
      </div>

      {!isSuper && (
        <>
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="press gradient-hero mt-5 flex h-14 items-center justify-center gap-2 rounded-3xl text-base font-bold text-primary-foreground shadow-[var(--shadow-float)]"
          >
            <MessageCircle className="size-5" /> اشترك في السوبر
          </a>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            سيتم تحويلك إلى واتساب لإتمام الاشتراك، ويقوم فريق سَقرو بتفعيل حسابك مباشرة بعد التأكيد.
          </p>
        </>
      )}

      {isSuper && subscription && (
        <Card className="mt-5 flex items-center gap-3">
          <Sparkles className="size-5 text-warning" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">اشتراكك فعّال</h3>
            <p className="text-[11px] text-muted-foreground">
              الخطة: {subscription.plan === "referral" ? "مكافأة دعوة الأصدقاء" : "سوبر"} · ينتهي في{" "}
              {fmt(subscription.expires_at)}
            </p>
          </div>
        </Card>
      )}

      {isSuper && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer noopener"
          className="press mt-3 flex h-13 items-center justify-center gap-2 rounded-3xl border border-border bg-card py-3.5 text-sm font-bold shadow-[var(--shadow-soft)]"
        >
          <MessageCircle className="size-4 text-primary" /> تمديد أو إلغاء الاشتراك
        </a>
      )}
    </Screen>
  );
}
