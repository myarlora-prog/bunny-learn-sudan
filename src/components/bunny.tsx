import bunnyImg from "@/assets/bunny.png";
import bunnyStudyImg from "@/assets/bunny-study.png";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "wave" | "study";
  size?: number;
  float?: boolean;
  className?: string;
  priority?: boolean;
};

export function Bunny({ variant = "wave", size = 120, float = false, className, priority = false }: Props) {
  return (
    <img
      src={variant === "study" ? bunnyStudyImg : bunnyImg}
      alt="بَني، رفيق المذاكرة"
      width={816}
      height={816}
      loading={priority ? "eager" : "lazy"}
      style={{ width: size, height: size }}
      className={cn("select-none object-contain drop-shadow-xl", float && "float-slow", className)}
    />
  );
}

export function BunnyEmpty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Bunny variant="study" size={132} float />
      <h3 className="text-base font-bold">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
