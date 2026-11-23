import { describe, expect, it } from "vitest";
import { chooseHierarchySelection, previousHierarchyStep } from "./admin-hierarchy";

const stage = { id: "stage-1", name: "المرحلة المتوسطة" };
const grade = { id: "grade-1", name: "الصف الأول" };
const subject = { id: "subject-1", name: "العلوم" };

describe("owner curriculum hierarchy", () => {
  it("moves back exactly one level and stops at the owner root", () => {
    expect(previousHierarchyStep(5)).toBe(4);
    expect(previousHierarchyStep(1)).toBe(0);
    expect(previousHierarchyStep(0)).toBe(0);
  });

  it("keeps selected ancestors and descendants when revisiting the same choice", () => {
    const selection = [stage, grade, subject];
    expect(chooseHierarchySelection(selection, 0, stage)).toBe(selection);
    expect(chooseHierarchySelection(selection, 0, stage)).toEqual([stage, grade, subject]);
  });

  it("drops only descendants when a selected level changes", () => {
    const otherGrade = { id: "grade-2", name: "الصف الثاني" };
    expect(chooseHierarchySelection([stage, grade, subject], 1, otherGrade)).toEqual([stage, otherGrade]);
  });
});
