import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Layers,
  Users,
  BookOpen,
  Megaphone,
  CreditCard,
  Settings2,
  Upload,
  FileCheck2,
  Gift,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/guards";
import {
  AdminAnnouncements,
  AdminCurriculum,
  AdminDashboard,
  AdminDrafts,
  AdminPublished,
  AdminReferrals,
  AdminSettings,
  AdminSubscriptions,
  AdminUpload,
  AdminUsers,
} from "@/components/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | سَقرو" },
      { name: "description", content: "لوحة تحكم خاصة بمالك تطبيق سَقرو لإدارة المنهج والمستخدمين والاشتراكات." },
      { property: "og:title", content: "لوحة التحكم | سَقرو" },
      { property: "og:description", content: "إدارة المنهج والمستخدمين والاشتراكات في سَقرو." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const SETTING_KEYS = [
  { key: "whatsapp_link", label: "رابط واتساب للاشتراك", hint: "مثال: https://wa.me/2499XXXXXXX" },
  { key: "energy_daily", label: "الطاقة اليومية", hint: "العدد الأساسي يوميًا" },
  { key: "energy_regen_minutes", label: "دقائق تجديد الطاقة" },
  { key: "energy_regen_max", label: "أقصى طاقة متجددة" },
  { key: "referral_goal", label: "عدد الإحالات المطلوبة للمكافأة" },
  { key: "referral_reward_days", label: "أيام السوبر كمكافأة" },
];

type SectionId =
  | "curriculum"
  | "upload"
  | "drafts"
  | "published"
  | "users"
  | "subs"
  | "announcements"
  | "referrals"
  | "settings";

const SECTIONS: { id: SectionId; label: string; desc: string; Icon: typeof BookOpen }[] = [
  { id: "curriculum", label: "إدارة المنهج", desc: "المراحل، الصفوف، المواد، الوحدات، الدروس", Icon: BookOpen },
  { id: "upload", label: "رفع كتاب ومعالجته", desc: "PDF أو TXT ← تحليل بالذكاء الاصطناعي", Icon: Upload },
  { id: "drafts", label: "مراجعة المسودات", desc: "تعديل المحتوى المستخرج ثم النشر", Icon: FileCheck2 },
  { id: "published", label: "المنهج المنشور", desc: "نشر أو إلغاء نشر الدروس", Icon: Layers },
  { id: "users", label: "إدارة المستخدمين", desc: "الأدوار، النقاط، الاشتراك", Icon: Users },
  { id: "subs", label: "الاشتراكات", desc: "تفعيل وتمديد السوبر", Icon: CreditCard },
  { id: "announcements", label: "الإشعارات", desc: "إرسال إعلان لكل الطلاب", Icon: Megaphone },
  { id: "referrals", label: "الإحالات", desc: "متابعة دعوات الأصدقاء", Icon: Gift },
  { id: "settings", label: "الإعدادات", desc: "الطاقة، رابط واتساب، الإحالات", Icon: Settings2 },
];

function SectionBody({ id }: { id: SectionId }) {
  if (id === "curriculum") return <AdminCurriculum />;
  if (id === "upload") return <AdminUpload />;
  if (id === "drafts") return <AdminDrafts />;
  if (id === "published") return <AdminPublished />;
  if (id === "users") return <AdminUsers />;
  if (id === "subs") return <AdminSubscriptions />;
  if (id === "announcements") return <AdminAnnouncements />;
  if (id === "referrals") return <AdminReferrals />;
  return <AdminSettings keys={SETTING_KEYS} />;
}

function AdminPage() {
  const { isAdmin, hydrated } = useRequireAdmin();
  const [section, setSection] = useState<SectionId | null>(null);

  if (!hydrated || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const active = SECTIONS.find((s) => s.id === section);

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-16 pt-8">
      <PageHeader
        title={active ? active.label : "لوحة التحكم"}
        subtitle={active ? active.desc : "خاصة بمالك التطبيق فقط"}
      />

      {active ? (
        <div className="flex flex-col gap-4">
          <button
            className="press inline-flex w-fit items-center gap-1 rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold"
            onClick={() => setSection(null)}
          >
            <ArrowRight className="size-3.5" />
            رجوع للوحة
          </button>
          <SectionBody id={active.id} />
        </div>
      ) : (
        <>
          <AdminDashboard />

          <div className="mt-6 flex flex-col gap-2.5">
            {SECTIONS.map(({ id, label, desc, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className="surface-card press flex items-center gap-3 p-4 text-right"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft">
                  <Icon className="size-5 text-primary" />
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{label}</h3>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <Link to="/home" className="mt-6 inline-block text-xs font-bold text-primary">
        العودة للتطبيق
      </Link>
    </div>
  );
}
