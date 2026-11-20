import { describe, expect, it } from "vitest";
import { bookCompletenessErrors, emptyDraftLesson, mergeUnits, missingLessonStages, splitBook } from "./book-parts";

const L = (t: string) => emptyDraftLesson(t);
const complete = (t: string) => ({
  ...L(t),
  explanation: "شرح كامل",
  summary: "ملخص كامل",
  key_points: ["نقطة"],
  flashcards: Array.from({ length: 15 }, (_, i) => ({ front: `س${i + 1}`, back: `ج${i + 1}` })),
  quiz: Array.from({ length: 15 }, (_, i) => ({ question: `${i + 1}. سؤال ${i + 1}`, options: ["أ", "ب"], correct_index: 0, explanation: "تفسير" })),
});

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
  it("combines a continued lesson source and invalidates its old partial output", () => {
    const first = complete("الدرس الأول");
    first.source_text = "النص الأول";
    const next = { ...emptyDraftLesson("الدرس الأول", "تكملة النص") };
    const merged = mergeUnits([{ title: "وحدة", description: "", lessons: [first] }], [{ title: "وحدة", description: "", lessons: [next] }]);
    expect(merged[0]!.lessons).toHaveLength(1);
    expect(merged[0]!.lessons[0]!.source_text).toBe("النص الأول\n\nتكملة النص");
    expect(missingLessonStages(merged[0]!.lessons[0]!)).toEqual(["content", "flashcards", "quiz"]);
  });
  it("keeps completed output when retrying the identical part", () => {
    const first = { ...complete("الدرس الأول"), source_text: "النص نفسه" };
    const next = emptyDraftLesson("الدرس الأول", "النص نفسه");
    const merged = mergeUnits([{ title: "وحدة", description: "", lessons: [first] }], [{ title: "وحدة", description: "", lessons: [next] }]);
    expect(bookCompletenessErrors(merged)).toEqual([]);
  });
  it("rejects fewer than 15 cards or questions instead of declaring completion", () => {
    const lesson = complete("درس");
    lesson.flashcards = lesson.flashcards.slice(0, 14);
    lesson.quiz = lesson.quiz.slice(0, 14);
    expect(missingLessonStages(lesson)).toEqual(["flashcards", "quiz"]);
    expect(bookCompletenessErrors([{ title: "وحدة", description: "", lessons: [lesson] }])).toEqual(["وحدة / درس: نواقص flashcards، quiz"]);
  });
  it("rejects duplicate cards and questions", () => {
    const lesson = complete("درس");
    lesson.flashcards[14] = lesson.flashcards[0]!;
    lesson.quiz[14] = { ...(lesson.quiz[0]!), question: "1. سؤال 1" };
    expect(bookCompletenessErrors([{ title: "وحدة", description: "", lessons: [lesson] }])).toEqual(["درس: بطاقات مكررة", "درس: أسئلة مكررة"]);
  });
});
