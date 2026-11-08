import { useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav, themeForPath } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Screen({
  children,
  nav = true,
  className,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = themeForPath(pathname);
  return (
    <div className={cn(theme, "relative min-h-screen w-full overflow-x-clip", theme && "bg-[image:var(--gradient-surface)]")}>
      <div className="relative mx-auto min-h-screen w-full max-w-lg">
        <div className={cn("page-enter px-5 pt-6", nav ? "pb-32" : "pb-10", className)}>{children}</div>
        {nav && <BottomNav />}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="app-page-header mb-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
      {back && (
        <Button variant="outline" size="icon"
          type="button"
          onClick={() => router.history.back()}
          className="press mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
          aria-label="رجوع"
        >
          <ChevronRight className="size-5 text-foreground" />
        </Button>
      )}
      <div className="col-start-2 min-w-0 flex-1">
        <h1 className="truncate text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={cn("surface-card press rise p-4", className)}>
      {children}
    </div>
  );
}
