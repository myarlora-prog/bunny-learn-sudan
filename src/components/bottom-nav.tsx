import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Library, Bot, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "الرئيسية", Icon: Home },
  { to: "/curriculum", label: "موادي", Icon: Library },
  { to: "/saqro", label: "سَقرو AI", Icon: Bot },
  { to: "/achievements", label: "الإنجازات", Icon: Trophy },
  { to: "/profile", label: "حسابي", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3 pb-3">
      <div className="glass-panel flex items-center justify-between rounded-3xl px-2 py-2 shadow-[var(--shadow-float)]">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "press flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-2xl transition-all duration-300",
                  active ? "gradient-hero shadow-[var(--shadow-soft)]" : "bg-transparent",
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary-foreground" : "text-muted-foreground")} />
              </span>
              <span className={cn(active ? "text-primary" : "")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
