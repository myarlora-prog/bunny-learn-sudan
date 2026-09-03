import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Moon, Bell, Languages, Volume2, ShieldCheck, Info } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | بَني" },
      { name: "description", content: "تحكّم في الوضع الليلي والتنبيهات والصوت واللغة داخل تطبيق بَني." },
      { property: "og:title", content: "الإعدادات | بَني" },
      { property: "og:description", content: "خصّص تجربتك في بَني كما تحب." },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
        on ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full bg-card shadow transition-all duration-300",
          on ? "right-1" : "right-6",
        )}
      />
    </button>
  );
}

function SettingsPage() {
  const { state, update } = useApp();
  const [notif, setNotif] = useState(true);
  const [sound, setSound] = useState(true);

  return (
    <Screen>
      <PageHeader title="الإعدادات" subtitle="خصّص تجربتك مع بَني" back />

      <div className="flex flex-col gap-2.5">
        <Card className="flex items-center gap-3">
          <Moon className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">الوضع الليلي</h3>
            <p className="text-[11px] text-muted-foreground">مريح للعين أثناء المذاكرة ليلًا</p>
          </div>
          <Toggle on={state.dark} onChange={(v) => update({ dark: v })} />
        </Card>

        <Card className="flex items-center gap-3">
          <Bell className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">تنبيهات المذاكرة</h3>
            <p className="text-[11px] text-muted-foreground">تذكير يومي بخطتك الدراسية</p>
          </div>
          <Toggle on={notif} onChange={setNotif} />
        </Card>

        <Card className="flex items-center gap-3">
          <Volume2 className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">المؤثرات الصوتية</h3>
            <p className="text-[11px] text-muted-foreground">أصوات خفيفة عند إنجاز المهام</p>
          </div>
          <Toggle on={sound} onChange={setSound} />
        </Card>

        <Card className="flex items-center gap-3">
          <Languages className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">اللغة</h3>
            <p className="text-[11px] text-muted-foreground">العربية (RTL)</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">الخصوصية والأمان</h3>
            <p className="text-[11px] text-muted-foreground">بياناتك محفوظة على جهازك</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <Info className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">عن التطبيق</h3>
            <p className="text-[11px] text-muted-foreground">بَني · الإصدار 1.0 · المنهج السوداني</p>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
