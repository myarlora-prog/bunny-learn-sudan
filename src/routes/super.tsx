import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { COUNTRIES, COUNTRY_KEY, countrySupportUrl } from "@/lib/support";
import { useSetting } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "كيفية فتح جميع الدروس | نوابغ" },
      { name: "description", content: "تعرّف على طريقة فتح جميع دروس صفك والتواصل مع نوابغ عبر واتساب." },
      { property: "og:title", content: "كيفية فتح جميع الدروس | نوابغ" },
      { property: "og:description", content: "اختر دولتك وتواصل معنا عبر واتساب للاستفسار عن فتح الدروس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperPage,
});

const FEATURES = ["فتح جميع الدروس في مرحلتك وصفك المحفوظين", "الوصول إلى شرح الدروس وملخصاتها", "مراجعة البطاقات وحل اختبارات الدروس"];

function SuperPage() {
  const { subscription, isSuper, state } = useApp();
  const { data: support } = useSetting("whatsapp_by_country");
  const { data: stages } = useStages();
  const { data: grades } = useGrades(state.stageId);
  const [country, setCountry] = useState("");
  useEffect(() => setCountry(localStorage.getItem(COUNTRY_KEY) ?? ""), []);
  const stage = stages?.find((x) => x.id === state.stageId)?.name ?? "غير محددة";
  const grade = grades?.find((x) => x.id === state.gradeId)?.name ?? "غير محدد";
  const message = `السلام عليكم،\n\nلدي استفسار حول فتح جميع دروس صفي في تطبيق نوابغ.\n\nاسم الطالب: ${state.name || "—"}\nالبريد الإلكتروني: ${state.email || "—"}\nالمرحلة الدراسية: ${stage}\nالصف: ${grade}\nالدولة الحالية: ${country}\n\nأرجو مساعدتي والإجابة عن استفساري.\n\nشكرًا لكم.`;
  const whatsapp = countrySupportUrl(support, country, message);
  const contact = () => {
    if (!country) { toast.error("اختر دولتك الحالية أولًا"); return; }
    if (!whatsapp) { toast.error("لا يوجد رقم دعم مُعدّ لهذه الدولة حاليًا"); return; }
    window.open(whatsapp, "_blank", "noopener,noreferrer");
  };

  return (
    <Screen>
      <PageHeader title="كيفية فتح جميع الدروس" subtitle="تواصل معنا مباشرة للاستفسار والمساعدة" back />
      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <Sparkles className="size-12 shrink-0 text-primary-foreground" />
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">{isSuper ? "جميع الدروس متاحة لك 🎉" : "افتح جميع دروس صفك"}</h2>
          <p className="mt-1 text-xs text-primary-foreground/85">{isSuper && subscription ? `الوصول متاح حتى ${new Date(subscription.expires_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}` : "اختر دولتك ثم أرسل استفسارك إلينا عبر واتساب."}</p>
        </div>
      </Card>
      <div className="mt-4 flex flex-col gap-2.5">
        {FEATURES.map((feature) => (
          <Card key={feature} className="flex items-center gap-3 py-3.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary-soft"><Check className="size-4 text-primary" /></span>
            <p className="flex-1 text-sm font-bold">{feature}</p>
          </Card>
        ))}
      </div>
      <label htmlFor="support-country" className="mb-2 mt-5 block text-xs font-bold">الدولة الحالية</label>
      <select id="support-country" className="w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm" value={country} onChange={(e) => { setCountry(e.target.value); localStorage.setItem(COUNTRY_KEY, e.target.value); }}>
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
