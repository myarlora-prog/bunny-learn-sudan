import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Bunny } from "@/components/bunny";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-state";
import { useGrades, useStages } from "@/lib/curriculum-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grade")({
  head: () => ({
    meta: [
      { title: "اختر الصف الدراسي | بَني" },
      { name: "description", content: "حدّد صفك الدراسي داخل المنهج السوداني ليعرض بَني موادك ووحداتك." },
      { property: "og:title", content: "اختر الصف الدراسي | بَني" },
      { property: "og:description", content: "اختر صفك ليبدأ بَني في تجهيز الدروس والملخصات." },
    ],
  }),
  component: GradePage,
});

function GradePage() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const { data: stages } = useStages();
  const stage = (stages ?? []).find((s) => s.id === state.stageId);
  const { data: grades, isLoading } = useGrades(state.stageId);

  return (
    <div className="page-enter mx-auto min-h-screen w-full max-w-lg px-5 pb-10 pt-8">
      <PageHeader title="اختر صفك" subtitle={stage?.name ?? ""} back />
      <div className="mb-5 flex justify-center">
        <Bunny variant="study" size={120} float priority />
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(grades ?? []).map((g) => {
          const active = state.gradeId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                update({ gradeId: g.id });
                void navigate({ to: "/home" });
              }}
              className={cn(
                "surface-card press rise flex min-h-24 flex-col items-center justify-center gap-2 p-4 text-center text-sm font-bold",
                active && "border-primary ring-2 ring-primary/25",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                📗
              </span>
              {g.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
