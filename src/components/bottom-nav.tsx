import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Flame, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const tabs = [
  { to: "/curriculum", label: "المكتبة", Icon: BookOpen, theme: "" },
  { to: "/quizzes", label: "اختباري", Icon: ClipboardCheck, theme: "theme-quiz" },
  { to: "/streak", label: "الاستريك", Icon: Flame, theme: "theme-streak" },
  { to: "/profile", label: "حسابي", Icon: UserRound, theme: "theme-account" },
] as const;

export function themeForPath(pathname: string) {
  return tabs.find((t) => pathname === t.to || pathname.startsWith(t.to + "/"))?.theme ?? "";
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3 pb-3">
      <div className="glass-panel flex items-center justify-between rounded-3xl px-2 py-2 shadow-[var(--shadow-float)]">
        {tabs.map(({ to, label, Icon, theme }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                theme,
                "press flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-bold transition-colors",
              )}
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-[14px] border-2 transition-all duration-300",
                  active
                    ? "border-transparent gradient-hero shadow-[var(--shadow-card)] -translate-y-0.5"
                    : "border-border bg-card",
                )}
              >
                <Icon
                  strokeWidth={active ? 2.4 : 2}
                  className={cn("size-[22px]", active ? "text-primary-foreground" : "text-muted-foreground")}
                />
              </span>
              <span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
              <span className={cn("h-1 w-1 rounded-full transition-opacity", active ? "bg-primary opacity-100" : "opacity-0")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
