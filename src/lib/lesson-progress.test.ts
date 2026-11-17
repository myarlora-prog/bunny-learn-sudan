import { describe, expect, it } from "vitest";
import { completionPercent, subjectCompletion, unitCompletion } from "./lesson-progress";

const units = [
  { id: "u1", lessons: Array.from({ length: 12 }, (_, i) => ({ id: `a${i}` })) },
  { id: "u2", lessons: Array.from({ length: 8 }, (_, i) => ({ id: `b${i}` })) },
];

describe("existing lesson completion progress", () => {
  it("shows 25% when 5 of 20 published lessons are complete", () => {
    expect(subjectCompletion(units, ["a0", "a1", "a2", "a3", "a4"])).toBe(25);
  });

  it("shows 50% at 10 lessons and 100% at all 20 lessons", () => {
    expect(subjectCompletion(units, units.flatMap((u) => u.lessons).slice(0, 10).map((l) => l.id))).toBe(50);
    expect(subjectCompletion(units, units.flatMap((u) => u.lessons).map((l) => l.id))).toBe(100);
  });

  it("calculates each unit independently", () => {
    const completed = ["a0", "a1", "a2", "b0", "b1", "b2", "b3"];
    expect(unitCompletion(units[0]!, completed)).toBe(25);
    expect(unitCompletion(units[1]!, completed)).toBe(50);
  });

  it("ignores duplicate, unpublished and stale completion ids", () => {
    expect(completionPercent(["a", "b"], ["a", "a", "deleted", "other"])).toBe(50);
    expect(completionPercent([], ["a"])).toBe(0);
  });
});
