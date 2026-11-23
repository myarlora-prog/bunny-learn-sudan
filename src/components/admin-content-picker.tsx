import type { ReactNode } from "react";
import { OwnerBreadcrumb, type OwnerBreadcrumbItem } from "@/components/admin-breadcrumb";
import { LevelList, rowLabel } from "@/components/admin-pickers";
import { useAdminHierarchy, type HierarchyChoice } from "@/lib/admin-hierarchy";

type Choice = HierarchyChoice;
const TABLES = ["stages", "grades", "subjects", "units", "lessons"] as const;
const LABELS = ["المرحلة", "الصف", "المادة", "الوحدة", "الدرس"];

export function AdminContentPicker({ lesson = false, onExit, children }: {
  lesson?: boolean;
  onExit: () => void;
  children: (selection: Choice[]) => ReactNode;
}) {
  const count = lesson ? 5 : 3;
  const { selection, step, choose, goTo, back } = useAdminHierarchy<Choice>(count);
  const table = TABLES[step];
  const path = [
    { id: "owner", label: "لوحة المالك", step: 0 },
    ...selection.slice(0, step).map((row, index) => ({ id: row.id, label: rowLabel(row), step: index + 1 })),
  ];
  if (step < count) path.push({ id: `level-${step}`, label: LABELS[step]!, step });
  const items: OwnerBreadcrumbItem[] = path.map((item, index) => ({
    id: item.id,
    label: item.label,
    onSelect: index < path.length - 1 ? () => item.step === 0 && step === 0 ? onExit() : goTo(item.step) : undefined,
  }));

  return (
    <div className="flex flex-col gap-4">
      <OwnerBreadcrumb
        items={items}
        onBack={step > 0 ? back : undefined}
        backLabel={step > 0 ? `رجوع إلى ${LABELS[step - 1]}` : undefined}
      />
      {step < count && table ? (
        <>
          <h3 className="text-base">اختر {LABELS[step]}</h3>
          <LevelList
            table={table}
            parentId={selection[step - 1]?.id ?? null}
            empty="لا توجد عناصر في هذا المستوى"
            onPick={choose}
          />
        </>
      ) : (
        children(selection)
      )}
    </div>
  );
}
