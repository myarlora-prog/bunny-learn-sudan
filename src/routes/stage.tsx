import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Bunny } from "@/components/bunny";
import { stages } from "@/data/curriculum";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stage")({
  head: () => ({
    meta: [
      { title: "اختر المرحلة الدراسية | بَني" },
      { name: "description", content: "اختر مرحلتك الدراسية في المنهج السوداني ليجهّز بَني محتواك التعليمي." },
      { property: "og:title", content: "اختر المرحلة الدراسية | بَني" },
      { property: "og:description", content: "الأساس، الثانوي، أو الشهادة السودانية — اختر ما يناسبك." },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  const { state, update } = useApp();
  const navigate = useNavigate();

  return (
    <div className="page-enter mx-auto min-h-screen w-full max-w-lg px-5 pb-10 pt-10">
      <div className="mb-6 flex items-center gap-4">
        <Bunny size={84} float priority />
        <div>
          <h1 className="text-2xl">في أي مرحلة أنت؟</h1>
          <p className="mt-1 text-sm text-muted-foreground">سأجهّز لك المنهج المناسب فورًا</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {stages.map((s) => {
          const active = state.stageId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                update({ stageId: s.id, gradeId: null });
                navigate({ to: "/grade" });
              }}
              className={cn(
                "surface-card press rise flex items-center gap-4 p-4 text-right",
                active && "border-primary ring-2 ring-primary/25",
              )}
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">
                {s.icon}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{s.name}</span>
                <span className="block text-xs text-muted-foreground">{s.desc}</span>
              </span>
              {active && <Check className="size-5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
