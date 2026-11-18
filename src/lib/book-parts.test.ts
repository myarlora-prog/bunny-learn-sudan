import { describe, expect, it } from "vitest";
import { mergeUnits, splitBook } from "./book-parts";

const L = (t: string) => ({ title: t, duration_minutes: 10, explanation: "", key_points: [], summary: "", key_terms: [], review_material: "", flashcards: [], quiz: [] });

describe("book parts", () => {
  it("keeps every character in order when splitting", () => {
    const text = Array.from({ length: 50 }, (_, i) => `فقرة ${i} `.repeat(40)).join("\n\n");
    const parts = splitBook(text, 2000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("\n\n")).toBe(text);
  });
  it("merges a unit that continues into the next part", () => {
    const a = [{ title: "الوحدة 1", description: "", lessons: [L("د1")] }];
    const b = [{ title: "الوحدة 1", description: "", lessons: [L("د2")] }, { title: "الوحدة 2", description: "", lessons: [L("د3")] }];
    const m = mergeUnits(a, b);
    expect(m.map((u) => u.lessons.map((l) => l.title))).toEqual([["د1", "د2"], ["د3"]]);
  });
});
