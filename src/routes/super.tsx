import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { useSetting } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "كيفية فتح جميع الدروس | نوابغ" },
      { name: "description", content: "اشترك في نوابغ سوبر: طاقة غير محدودة، شرح أعمق، بطاقات وأسئلة أكثر، ومنافسة أبطال نوابغ." },
      { property: "og:title", content: "كيفية فتح جميع الدروس | نوابغ" },
      { property: "og:description", content: "طاقة غير محدودة وشرح أعمق مع نوابغ سوبر." },
    ],
  }),
  component: SuperPage,
});

const FEATURES = [
  "طاقة غير محدودة — بدون انتظار",
  "شرح أعمق وملخصات أشمل لكل درس",
  "بطاقات مراجعة وأسئلة اختبار أكثر",
  "نوابغ AI بلا حدود وتدريب متقدم",
  "تخصيص كامل لشخصيتك",
  "منافسة أبطال نوابغ 🏆 كاملة",
];

function fmt(date: string) {
  return new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

const COUNTRIES = ["السودان", "السعودية", "مصر", "الإمارات", "قطر", "عُمان", "الكويت", "البحرين", "ليبيا", "أخرى"];

/** One circle per real calendar day for every month the subscription spans. */
function SubscriptionCalendar({ start, end }: { start: string; end: string }) {
  const s = new Date(start);
  const e = new Date(end);
  const months: Date[] = [];
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const today = new Date();
  return (
    <div className="mt-4 flex flex-col gap-3">
      {months.map((m) => {
        const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        return (
          <Card key={m.toISOString()}>
            <h3 className="mb-2 text-sm font-bold">{m.toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: days }, (_, i) => {
                const day = new Date(m.getFullYear(), m.getMonth(), i + 1, 12);
                const inside = day >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && day <= e;
                const past = inside && day < today;
                return (
                  <span
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full border text-[10px] font-bold",
                      inside ? (past ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary") : "border-border text-muted-foreground/50",
                    )}
                  >
                    {i + 1}
                  </span>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SuperPage() {
  const { subscription, isSuper, state } = useApp();
  const { data: link } = useSetting("whatsapp_link");
  const { data: stages } = useStages();
  const { data: grades } = useGrades(state.stageId);
  const [country, setCountry] = useState("");
  const stage = stages?.find((x) => x.id === state.stageId)?.name ?? "غير محددة";
  const grade = grades?.find((x) => x.id === state.gradeId)?.name ?? "غير محدد";
  const message = `السلام عليكم،

أرغب في فتح جميع الدروس في تطبيق نوابغ.

اسم الطالب: ${state.name || "—"}
البريد الإلكتروني: ${state.email || "—"}
المرحلة الدراسية: ${stage}
الصف: ${grade}
الدولة الحالية: ${country}

أرجو تزويدي بتفاصيل وطريقة تفعيل الاشتراك.

شكرًا لكم.`;
  const base = link || "https://wa.me/966557110297";
  const whatsapp = `${base}${base.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;

  return (
    <Screen>
      <PageHeader title="كيفية فتح جميع الدروس" subtitle="اختر دولتك ثم تواصل معنا عبر واتساب" back />

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

      {isSuper && subscription && <SubscriptionCalendar start={subscription.starts_at ?? new Date().toISOString()} end={subscription.expires_at} />}

      {!isSuper && (
        <>
          <select
            className="mt-5 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="الدولة الحالية"
          >
            <option value="">اختر دولتك الحالية</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <a
            aria-disabled={!country}
            onClick={(e) => { if (!country) { e.preventDefault(); } }}
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="press gradient-hero mt-5 flex h-14 items-center justify-center gap-2 rounded-3xl text-base font-bold text-primary-foreground shadow-[var(--shadow-float)]"
          >
            <MessageCircle className="size-5" /> {country ? "تواصل عبر واتساب" : "اختر دولتك أولًا"}
          </a>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            سيتم تحويلك إلى واتساب لإتمام الاشتراك، ويقوم فريق نوابغ بتفعيل حسابك مباشرة بعد التأكيد.
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
