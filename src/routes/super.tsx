import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { PageHeader, Screen } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Saqro } from "@/components/saqro";
import { toast } from "sonner";
import { COUNTRIES, COUNTRY_KEY, countrySupportUrl } from "@/lib/support";
import { useSetting } from "@/lib/account-db";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "كيفية فتح جميع الدروس | نوابغ" },
      { name: "description", content: "اختر الدولة التي أنت فيها الآن وتواصل مع نوابغ عبر واتساب لفتح جميع الدروس." },
      { property: "og:title", content: "كيفية فتح جميع الدروس | نوابغ" },
      { property: "og:description", content: "اختر دولتك وتواصل معنا عبر واتساب للاستفسار عن فتح الدروس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperPage,
});

function SuperPage() {
  const { state } = useApp();
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
    if (!country) return;
    if (!whatsapp) { toast.error("لا يوجد رقم دعم مُعدّ لهذه الدولة حاليًا"); return; }
    window.open(whatsapp, "_blank", "noopener,noreferrer");
  };

  return (
    <Screen>
      <div className="mb-4 flex justify-center"><Saqro size={104} priority /></div>
      <PageHeader title="كيفية فتح جميع الدروس" back />
      <p className="text-sm leading-relaxed text-muted-foreground">لفتح جميع الدروس، اختر الدولة التي أنت فيها الآن، وتواصل معنا عبر الواتساب.</p>
      <label htmlFor="support-country" className="mb-2 mt-6 block text-sm font-bold">1. اختر الدولة التي أنت فيها الآن</label>
      <select id="support-country" className="w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm" value={country} onChange={(e) => { setCountry(e.target.value); localStorage.setItem(COUNTRY_KEY, e.target.value); }}>
        <option value="">اختر دولتك الحالية</option>
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {country && (
        <Button data-tour="unlock-help" onClick={contact} className="gradient-hero mt-5 h-auto min-h-14 w-full whitespace-normal rounded-3xl py-3 text-sm font-bold">
          <MessageCircle />تواصل معنا عبر الواتساب
        </Button>
      )}
    </Screen>
  );
}
