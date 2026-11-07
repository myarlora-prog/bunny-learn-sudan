import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { LevelList, rowLabel } from "@/components/admin-pickers";
import { Button } from "@/components/ui/button";

type Choice = { id: string; name?: string; title?: string };
const TABLES = ["stages", "grades", "subjects", "units", "lessons"] as const;
const LABELS = ["المرحلة", "الصف", "المادة", "الوحدة", "الدرس"];

export function AdminContentPicker({ lesson = false, children }: {
  lesson?: boolean;
  children: (selection: Choice[]) => ReactNode;
}) {
  const [selection, setSelection] = useState<Choice[]>([]);
  const [step, setStep] = useState(0);
  const count = lesson ? 5 : 3;
  const table = TABLES[step];
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {selection.slice(0, step).map((r) => <span key={r.id}>{rowLabel(r)} /</span>)}
    </div>
    {step > 0 && <Button variant="outline" className="w-fit" onClick={() => setStep((s) => s - 1)}><ArrowRight />رجوع إلى {LABELS[step - 1]}</Button>}
    {step < count && table ? <>
      <h3 className="text-base">اختر {LABELS[step]}</h3>
      <LevelList table={table} parentId={selection[step - 1]?.id ?? null} empty="لا توجد عناصر في هذا المستوى" onPick={(r) => {
        setSelection((old) => old[step]?.id === r.id ? old : [...old.slice(0, step), r]);
        setStep((s) => s + 1);
      }} />
    </> : children(selection)}
  </div>;
}