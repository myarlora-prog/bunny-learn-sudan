import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers, Users, BookOpen, Megaphone, CreditCard, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAdmin } from "@/lib/guards";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | بَني" },
      { name: "description", content: "لوحة تحكم خاصة بمالك تطبيق بَني لإدارة المنهج والمستخدمين والاشتراكات." },
      { property: "og:title", content: "لوحة التحكم | بَني" },
      { property: "og:description", content: "إدارة المنهج والمستخدمين والاشتراكات في بَني." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [stages, grades, subjects, lessons, users, subs] = await Promise.all([
        supabase.from("stages").select("id", { count: "exact", head: true }),
        supabase.from("grades").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return {
        stages: stages.count ?? 0,
        grades: grades.count ?? 0,
        subjects: subjects.count ?? 0,
        lessons: lessons.count ?? 0,
        users: users.count ?? 0,
        subs: subs.count ?? 0,
      };
    },
  });
}

function AdminPage() {
  const { isAdmin, hydrated } = useRequireAdmin();
  const { data } = useAdminStats();

  if (!hydrated || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "المراحل", value: data?.stages ?? 0, Icon: Layers },
    { label: "الصفوف", value: data?.grades ?? 0, Icon: Layers },
    { label: "المواد", value: data?.subjects ?? 0, Icon: BookOpen },
    { label: "الدروس", value: data?.lessons ?? 0, Icon: BookOpen },
    { label: "الطلاب", value: data?.users ?? 0, Icon: Users },
    { label: "اشتراكات فعّالة", value: data?.subs ?? 0, Icon: CreditCard },
  ];

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-16 pt-8">
      <PageHeader title="لوحة التحكم" subtitle="خاصة بمالك التطبيق فقط" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="surface-card rise p-4 text-center">
            <Icon className="mx-auto size-5 text-primary" />
            <p className="mt-2 text-xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {[
          { label: "إدارة المنهج", desc: "المراحل، الصفوف، المواد، الوحدات، الدروس", Icon: BookOpen },
          { label: "إدارة المستخدمين", desc: "الأدوار، الصفوف، النقاط", Icon: Users },
          { label: "الاشتراكات", desc: "تفعيل وتمديد السوبر", Icon: CreditCard },
          { label: "الإشعارات", desc: "إرسال إعلان لكل الطلاب", Icon: Megaphone },
          { label: "الإعدادات", desc: "الطاقة، رابط واتساب، الإحالات", Icon: Settings2 },
        ].map(({ label, desc, Icon }) => (
          <div key={label} className="surface-card flex items-center gap-3 p-4">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft">
              <Icon className="size-5 text-primary" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-bold">{label}</h3>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <span className="rounded-xl bg-secondary px-2 py-1 text-[10px] text-muted-foreground">قريبًا</span>
          </div>
        ))}
      </div>

      <Link to="/home" className="mt-6 inline-block text-xs font-bold text-primary">
        العودة للتطبيق
      </Link>
    </div>
  );
}
