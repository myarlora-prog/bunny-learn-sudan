import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { COUNTRIES, COUNTRY_KEY, countrySupportUrl } from "@/lib/support";
import { useSetting } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "Super | نوابغ" },
      { name: "description", content: "سوبر يفتح دروس صفك وشرحها وملخصاتها وبطاقاتها واختباراتها." },
      { property: "og:title", content: "Super | نوابغ" },
      { property: "og:description", content: "تعرّف على الفرق بين المجاني وسوبر وتواصل مع دعم نوابغ." },
    ],
  }),
  component: SuperPage,
});

const FEATURES = [
  "فتح جميع الدروس في مرحلتك وصفك المحفوظين",
  "الوصول إلى شرح الدروس وملخصاتها",
  "مراجعة البطاقات وحل اختبارات الدروس",
];

function fmt(date: string) {
  return new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}



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
  const { data: support } = useSetting("whatsapp_by_country");
  const { data: stages } = useStages();
  const { data: grades } = useGrades(state.stageId);
  const [country, setCountry] = useState("");
  useEffect(() => setCountry(localStorage.getItem(COUNTRY_KEY) ?? ""), []);
  const stage = stages?.find((x) => x.id === state.stageId)?.name ?? "غير محددة";
  const grade = grades?.find((x) => x.id === state.gradeId)?.name ?? "غير محدد";
  const message = `السلام عليكم،

لدي استفسار حول إتاحة جميع دروس صفي ومميزات Super في تطبيق نوابغ.

اسم الطالب: ${state.name || "—"}
البريد الإلكتروني: ${state.email || "—"}
المرحلة الدراسية: ${stage}
الصف: ${grade}
الدولة الحالية: ${country}

أرجو مساعدتي والإجابة عن استفساري.

شكرًا لكم.`;
  const whatsapp = countrySupportUrl(support, country, message);
  const contact = () => {
    if (!country) { toast.error("اختر دولتك الحالية أولًا"); return; }
    if (!whatsapp) { toast.error("لا يوجد رقم دعم مُعدّ لهذه الدولة حاليًا"); return; }
    window.open(whatsapp, "_blank", "noopener,noreferrer");
  };

  return (
    <Screen>
      <PageHeader title="Super" subtitle="جميع دروس صفك في متناولك" back />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <Sparkles className="size-12 shrink-0 text-primary-foreground" />
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">
            {isSuper ? "أنت مشترك في السوبر 🎉" : "الخطة المجانية"}
          </h2>
          <p className="mt-1 text-xs text-primary-foreground/85">
            {isSuper && subscription
              ? `ينتهي في ${fmt(subscription.expires_at)}`
              : "المجاني: الدروس التي يفتحها المالك فقط. سوبر: جميع دروس صفك."}
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

      <select className="mt-5 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm" value={country}
        onChange={(e) => { setCountry(e.target.value); localStorage.setItem(COUNTRY_KEY, e.target.value); }} aria-label="الدولة الحالية">
        <option value="">اختر دولتك الحالية</option>
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <Button onClick={contact} className="gradient-hero mt-5 h-auto min-h-14 w-full whitespace-normal rounded-3xl py-3 text-sm font-bold">
        <MessageCircle />لفتح جميع الدروس، تواصل معنا عبر الواتساب.
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">التواصل للدعم والاستفسارات فقط.</p>
    </Screen>
  );
}
