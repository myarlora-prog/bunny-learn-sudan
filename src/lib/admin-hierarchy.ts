import { useState } from "react";

export type HierarchyChoice = { id: string; name?: string; title?: string };

/** Move back exactly one curriculum level, never beyond the owner panel root. */
export function previousHierarchyStep(step: number) {
  return Math.max(0, step - 1);
}

/** Keep the selected path; changing a choice invalidates only its descendants. */
export function chooseHierarchySelection<T extends HierarchyChoice>(selection: T[], step: number, choice: T) {
  if (selection[step]?.id === choice.id) return selection;
  return [...selection.slice(0, step), choice];
}

export function useAdminHierarchy<T extends HierarchyChoice>(count = 5) {
  const [selection, setSelection] = useState<T[]>([]);
  const [step, setStep] = useState(0);

  const choose = (choice: T) => {
    setSelection((current) => chooseHierarchySelection(current, step, choice));
    setStep((current) => Math.min(count, current + 1));
  };
  const goTo = (target: number) => setStep(Math.max(0, Math.min(count, target)));
  const back = () => setStep(previousHierarchyStep);

  return { selection, step, choose, goTo, back };
}
