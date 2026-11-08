import { splitExamSource } from "./exam-utils";
export type CurriculumScope = "subject" | "units" | "lessons" | "text" | "file";
export type CurriculumSourceLesson = { id: string; title: string; unitId: string; unitTitle: string; explanation: string; original: string; supporting: string; previous: string[] };
export type WorkItem = { lessonId: string | null; unitId: string | null; title: string; text: string; original: string; part: number; parts: number };
export function scopeLessons(lessons: CurriculumSourceLesson[], scope: CurriculumScope, selected: string[]) {
  if (scope === "subject") return lessons;
  const ids = new Set(selected);
  return lessons.filter((l) => ids.has(scope === "units" ? l.unitId : l.id));
}
export function toWorkItems(lessons: CurriculumSourceLesson[], kind: "exam" | "format"): WorkItem[] {
  return lessons.flatMap((l) => {
    const text = kind === "format" ? l.explanation : `الشرح المعتمد (المصدر الأساسي):\n${l.explanation}\nالشرح الأصلي المحفوظ:\n${l.original}\nمصادر مساعدة:\n${l.supporting}`;
    const chunks = splitExamSource(text, 12000);
    return chunks.map((chunk, i) => ({ lessonId: l.id, unitId: l.unitId, title: `${l.unitTitle} · ${l.title}`, text: chunk, original: l.explanation, part: i + 1, parts: chunks.length }));
  });
}
export function questionEstimate(items: WorkItem[]) {
  const chars = items.reduce((n, item) => n + item.text.replace(/<[^>]*>/g, "").length, 0);
  return { min: Math.max(items.length, Math.floor(chars / 650)), max: Math.max(items.length, Math.ceil(chars / 220)) };
}
export function allocatedCount(items: WorkItem[], index: number, total: number | null) {
  if (total === null) return null;
  // Every selected source gets coverage; refuse an undersized manual count before a job starts.
  const extra = total - items.length;
  const weight = items.reduce((n, item) => n + item.text.length, 0);
  const before = items.slice(0, index).reduce((n, item) => n + item.text.length, 0);
  const current = items[index];
  if (!current || weight === 0) return 1;
  return 1 + Math.floor(extra * (before + current.text.length) / weight) - Math.floor(extra * before / weight);
}
/** Formatting is accepted for review only when every source word survives in order. */
export function retainsSource(source: string, formatted: string) {
  const words = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  const original = words(source); const next = words(formatted); let cursor = 0;
  for (const word of next) if (word === original[cursor]) cursor++;
  return original.length > 0 && cursor === original.length;
}