import { createFileRoute } from "@tanstack/react-router";
import { Moon, Bell, Languages, Volume2, ShieldCheck, Info, Sun, Monitor } from "lucide-react";
import { Card, PageHeader, Screen } from "@/components/app-shell";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | نوابغ" },
      { name: "description", content: "تحكّم في الوضع الليلي والتنبيهات والصوت واللغة داخل تطبيق نوابغ." },
      { property: "og:title", content: "الإعدادات | نوابغ" },
      { property: "og:description", content: "خصّص تجربتك في نوابغ كما تحب." },
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

  return (
    <Screen>
      <PageHeader title="الإعدادات" subtitle="خصّص تجربتك مع نوابغ" back />

      <div className="flex flex-col gap-2.5">
        <Card>
          <div className="flex items-center gap-3">
            <Moon className="size-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-bold">مظهر التطبيق</h3>
              <p className="text-[11px] text-muted-foreground">داكن افتراضيًا، أو فاتح، أو حسب جهازك</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="اختيار المظهر">
            {([
              { mode: "dark", label: "داكن", Icon: Moon },
              { mode: "light", label: "فاتح", Icon: Sun },
              { mode: "system", label: "تلقائي", Icon: Monitor },
            ] as const).map(({ mode, label, Icon }) => (
              <button key={mode} type="button" aria-pressed={state.themeMode === mode} onClick={() => update({ themeMode: mode, dark: mode === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : mode === "dark" })} className={cn("press flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-bold", state.themeMode === mode ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground")}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <Bell className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">تنبيهات المذاكرة</h3>
            <p className="text-[11px] text-muted-foreground">تذكير يومي بخطتك الدراسية</p>
          </div>
          <Toggle on={state.notifications} onChange={(v) => update({ notifications: v })} />
        </Card>

        <Card className="flex items-center gap-3">
          <Volume2 className="size-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-bold">المؤثرات الصوتية</h3>
            <p className="text-[11px] text-muted-foreground">أصوات خفيفة عند إنجاز المهام</p>
          </div>
          <Toggle on={state.sound} onChange={(v) => update({ sound: v })} />
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
            <p className="text-[11px] text-muted-foreground">نوابغ · الإصدار 1.0 · المنهج السوداني</p>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
