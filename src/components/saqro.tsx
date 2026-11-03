import logo from "@/assets/nawabig-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "wave" | "study";
  size?: number;
  float?: boolean;
  className?: string;
  priority?: boolean;
};

/** Official Nawabig logo (replaces former mascot illustrations). */
export function Saqro({ size = 120, className, priority = false }: Props) {
  return (
    <img
      src={logo.url}
      alt="شعار نوابغ"
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      style={{ width: size, height: size }}
      className={cn("select-none rounded-full object-contain", className)}
    />
  );
}

export function SaqroEmpty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Saqro size={96} />
      <h3 className="text-base font-bold">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
