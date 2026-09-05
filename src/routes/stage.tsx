import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { Saqro } from "@/components/saqro";
import { useApp } from "@/lib/app-state";
import { useStages } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stage")({
  head: () => ({
    meta: [
      { title: "اختر المرحلة الدراسية | سَقرو" },
      { name: "description", content: "اختر مرحلتك الدراسية في المنهج السوداني ليجهّز سَقرو محتواك التعليمي." },
      { property: "og:title", content: "اختر المرحلة الدراسية | سَقرو" },
      { property: "og:description", content: "الأساس، الثانوي، أو الشهادة السودانية — اختر ما يناسبك." },
    ],
  }),
  component: StagePage,
});

const ICONS = ["🎒", "📘", "🎓"];

function StagePage() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const { data: stages, isLoading, isError } = useStages();

  return (
    <div className="page-enter mx-auto min-h-screen w-full max-w-lg px-5 pb-10 pt-10">
      <div className="mb-6 flex items-center gap-4">
        <Saqro size={84} float priority />
        <div>
          <h1 className="text-2xl">هل أنت طالب؟ نعم 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">اختر مرحلتك وسأجهّز لك المنهج المناسب</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      )}
      {isError && <p className="text-sm text-destructive">تعذّر تحميل المراحل، تحقق من اتصالك وحاول مجددًا.</p>}

      <div className="flex flex-col gap-3">
        {(stages ?? []).map((s, i) => {
          const active = state.stageId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                update({ stageId: s.id, gradeId: null });
                void navigate({ to: "/grade" });
              }}
              className={cn(
                "surface-card press rise flex items-center gap-4 p-4 text-right",
                active && "border-primary ring-2 ring-primary/25",
              )}
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">
                {ICONS[i % ICONS.length]}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{s.name}</span>
                {s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}
              </span>
              {active && <Check className="size-5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
