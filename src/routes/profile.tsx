import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Settings, CalendarDays, Trophy, GraduationCap, ChevronLeft, LogOut } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { Saqro } from "@/components/saqro";
import { allLessons, stages } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "حسابي | سَقرو" },
      { name: "description", content: "ملفك الشخصي في سَقرو: مرحلتك وصفك ونقاطك وإعداداتك الدراسية." },
      { property: "og:title", content: "حسابي | سَقرو" },
      { property: "og:description", content: "أدر بياناتك الدراسية وإعداداتك داخل تطبيق سَقرو." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, signOut } = useApp();
  const navigate = useNavigate();
  const stage = stages.find((s) => s.id === state.stageId);
  const grade = stage?.grades.find((g) => g.id === state.gradeId);

  const links = [
    { to: "/planner", label: "الخطة اليومية", desc: "نظّم مذاكرتك ساعة بساعة", Icon: CalendarDays },
    { to: "/achievements", label: "الإنجازات والمكافآت", desc: "أوسمتك ونقاطك", Icon: Trophy },
    { to: "/stage", label: "تغيير المرحلة والصف", desc: stage ? `${stage.name}` : "لم يتم الاختيار بعد", Icon: GraduationCap },
    { to: "/settings", label: "الإعدادات", desc: "المظهر، التنبيهات، اللغة", Icon: Settings },
  ] as const;

  return (
    <Screen>
      <PageHeader title="حسابي" />

      <Card className="gradient-hero flex items-center gap-4 border-transparent">
        <Saqro size={72} float />
        <div className="flex-1 text-primary-foreground">
          <h2 className="text-lg text-primary-foreground">{state.name || "طالب سَقرو"}</h2>
          <p className="text-xs text-primary-foreground/85">{state.email || "لم يتم إدخال بريد إلكتروني"}</p>
          <p className="mt-1 text-xs text-primary-foreground/85">{grade ? `${stage?.name} · ${grade.name}` : "اختر مرحلتك الدراسية"}</p>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "نقاطي", value: state.points },
          { label: "دروس مكتملة", value: `${state.completedLessons.length}/${allLessons.length}` },
          { label: "أيام متواصلة", value: state.streak },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

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
