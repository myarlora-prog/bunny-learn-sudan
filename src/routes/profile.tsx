import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Settings,
  CalendarDays,
  Trophy,
  GraduationCap,
  ChevronLeft,
  LogOut,
  Gift,
  Sparkles,
  Smile,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { EnergyBadge } from "@/components/energy";
import { useApp } from "@/lib/app-state";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { levelFor } from "@/lib/levels";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "حسابي | سَقرو" },
      { name: "description", content: "ملفك الشخصي في سَقرو: مرحلتك وصفك ونقاطك واشتراكك وإعداداتك الدراسية." },
      { property: "og:title", content: "حسابي | سَقرو" },
      { property: "og:description", content: "أدر بياناتك الدراسية واشتراكك داخل تطبيق سَقرو." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, signOut, isSuper, subscription, isAdmin } = useApp();
  const navigate = useNavigate();
  const { data: stages } = useStages();
  const { data: grades } = useGrades(state.stageId);
  const stage = stages?.find((s) => s.id === state.stageId);
  const grade = grades?.find((g) => g.id === state.gradeId);
  const level = levelFor(state.points);

  const links = [
    { to: "/stage", label: "البيانات الأكاديمية", desc: grade ? `${stage?.name ?? ""} · ${grade.name}` : "اختر مرحلتك وصفك", Icon: GraduationCap },
    { to: "/avatar", label: "تخصيص الشخصية", desc: isSuper ? "كل الشخصيات مفتوحة" : "الشخصية الأساسية", Icon: Smile },
    { to: "/referrals", label: "دعوة الأصدقاء 🎁", desc: "١٠ دعوات = ١٤ يومًا سوبر", Icon: Gift },
    { to: "/heroes", label: "أبطال Saqro 🏆", desc: "ترتيب صفك الدراسي", Icon: Trophy },
    { to: "/super", label: "سَقرو سوبر", desc: isSuper ? "اشتراكك مفعّل" : "افتح التجربة الكاملة", Icon: Sparkles },
    { to: "/planner", label: "الخطة اليومية", desc: "نظّم مذاكرتك ساعة بساعة", Icon: CalendarDays },
    { to: "/settings", label: "الإعدادات", desc: "المظهر، التنبيهات، اللغة", Icon: Settings },
  ] as const;

  return (
    <Screen>
      <PageHeader title="حسابي" action={<EnergyBadge />} />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <span className="flex size-[72px] items-center justify-center rounded-3xl bg-primary-foreground/15 text-4xl">
          {state.avatar}
        </span>
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">{state.name || "طالب سَقرو"}</h2>
          <p className="text-xs text-primary-foreground/85">{state.email || "لم يتم إدخال بريد إلكتروني"}</p>
          <p className="mt-1 text-xs text-primary-foreground/85">
            {grade ? `${stage?.name} · ${grade.name}` : "اختر مرحلتك الدراسية"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
            {isSuper ? "سوبر ⭐" : "مجاني"} · {level.name}
          </span>
        </div>
      </Card>

      {isSuper && subscription && (
        <Card className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          اشتراك السوبر فعّال حتى{" "}
          <span className="font-bold text-foreground">
            {new Date(subscription.expires_at).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </Card>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {[
          { label: "نقاطي", value: state.points },
          { label: "دروس", value: state.completedLessons.length },
          { label: "أيام متواصلة", value: state.streak },
          { label: "أطول تتابع", value: state.longestStreak },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-3 flex items-center gap-3">
        <Flame className="size-5 text-warning" />
        <p className="flex-1 text-xs text-muted-foreground">
          مستواك الحالي: <span className="font-bold text-foreground">{level.name}</span>
          {level.next !== null ? ` · ${level.next - state.points} نقطة للمستوى التالي` : " · أعلى مستوى 🎉"}
        </p>
      </Card>

      <div className="mt-4 flex flex-col gap-2.5">
        {links.map(({ to, label, desc, Icon }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft">
                <Icon className="size-5 text-primary" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-bold">{label}</h3>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
              <ChevronLeft className="size-5 text-muted-foreground" />
            </Card>
          </Link>
        ))}
        {isAdmin && (
          <Link to="/admin">
            <Card className="flex items-center gap-3 border-primary/40">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft">
                <ShieldCheck className="size-5 text-primary" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Owner Admin</h3>
                <p className="text-[11px] text-muted-foreground">لوحة تحكم المالك</p>
              </div>
              <ChevronLeft className="size-5 text-muted-foreground" />
            </Card>
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          await navigate({ to: "/auth", replace: true });
        }}
        className="press mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-3xl border border-destructive/30 bg-destructive/10 py-3.5 text-sm font-bold text-destructive"
      >
        <LogOut className="size-4" /> تسجيل الخروج
      </button>
    </Screen>
  );
}
