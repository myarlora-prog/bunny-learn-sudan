import lightLogo from "@/assets/nawabig-logo-light.png.asset.json";
import darkLogo from "@/assets/nawabig-logo-dark.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "wave" | "study";
  size?: number;
  float?: boolean;
  className?: string;
  priority?: boolean;
};

/** Official Nawabig artwork paired with the active light or dark appearance. */
export function Saqro({ size = 120, className, priority = false }: Props) {
  const shared = {
    width: size,
    height: size,
    loading: priority ? "eager" as const : "lazy" as const,
    decoding: "async" as const,
    draggable: false,
    fetchPriority: priority ? "high" as const : "auto" as const,
    style: { width: size, height: size },
  };
  return (
    <>
      <img
        {...shared}
        src={lightLogo.url}
        alt="شعار نوابغ"
        data-logo="light"
        className={cn("select-none object-contain [image-rendering:auto] dark:hidden", className)}
      />
      <img
        {...shared}
        src={darkLogo.url}
        alt=""
        aria-hidden
        data-logo="dark"
        className={cn("hidden select-none object-contain [image-rendering:auto] dark:block", className)}
      />
    </>
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
