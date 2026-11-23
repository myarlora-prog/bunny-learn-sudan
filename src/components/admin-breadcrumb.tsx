import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OwnerBreadcrumbItem = {
  id: string;
  label: string;
  onSelect?: (() => void) | undefined;
};

export function OwnerBreadcrumb({ items, onBack, backLabel }: {
  items: OwnerBreadcrumbItem[];
  onBack?: (() => void) | undefined;
  backLabel?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="مسار التنقل في لوحة المالك" className="surface-card overflow-hidden px-3 py-2.5">
        <ol className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => {
            const current = index === items.length - 1;
            return (
              <li key={item.id} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronLeft aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
                {current || !item.onSelect ? (
                  <span
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "max-w-36 truncate rounded-lg px-2 py-1.5 font-bold",
                      current ? "bg-primary-soft text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={item.onSelect}
                    className="press max-w-36 truncate rounded-lg px-2 py-1.5 font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {onBack && (
        <Button type="button" variant="outline" className="w-fit" onClick={onBack}>
          <ArrowRight aria-hidden="true" />
          {backLabel ?? "رجوع خطوة واحدة"}
        </Button>
      )}
    </div>
  );
}
