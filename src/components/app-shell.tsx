import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";

export function Screen({
  children,
  nav = true,
  className,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-lg">
      <div className={cn("page-enter px-5 pt-6", nav ? "pb-32" : "pb-10", className)}>{children}</div>
      {nav && <BottomNav />}
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
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start gap-3">
      {back && (
        <Link
          to={back}
          className="press mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
          aria-label="رجوع"
        >
          <ChevronRight className="size-5 text-foreground" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
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
