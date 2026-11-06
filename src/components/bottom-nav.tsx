import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Compass, Flame, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const tabs = [
  { to: "/curriculum", label: "المكتبة", Icon: BookOpen, theme: "" },
  { to: "/quizzes", label: "اختباراتي", Icon: Compass, theme: "theme-quiz" },
  { to: "/streak", label: "التقدم", Icon: Flame, theme: "theme-streak" },
  { to: "/profile", label: "حسابي", Icon: UserRound, theme: "theme-account" },
] as const;

export function themeForPath(pathname: string) {
  return tabs.find((t) => pathname === t.to || pathname.startsWith(t.to + "/"))?.theme ?? "";
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-4 pb-4">
      <div className="glass-panel flex items-center justify-between gap-1 rounded-[32px] px-2 py-2 shadow-[var(--shadow-float)]">
        {tabs.map(({ to, label, Icon, theme }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={cn(
                theme,
                "press flex h-14 items-center justify-center gap-2 rounded-full transition-all duration-300 ease-out",
                active ? "flex-[2.2] bg-primary-soft px-4" : "flex-1",
              )}
            >
              <Icon
                strokeWidth={active ? 2.4 : 1.8}
                className={cn("size-6 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")}
              />
              {active && <span className="rise whitespace-nowrap text-sm font-bold text-primary">{label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
