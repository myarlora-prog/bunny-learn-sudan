import type { DraftLesson, DraftUnit } from "@/lib/admin-ai.functions";

/** Split book text into ordered parts on paragraph/page boundaries. */
export function splitBook(text: string, size = 12000): string[] {
  const paras = text.split(/\n{2,}/);
  const parts: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > size) { parts.push(cur); cur = ""; }
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) parts.push(p.slice(i, i + size));
      continue;
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export function emptyDraftLesson(title: string, sourceText = ""): DraftLesson {
  return { title, duration_minutes: 20, explanation: "", key_points: [], summary: "", key_terms: [], review_material: "", flashcards: [], quiz: [], ...(sourceText ? { source_text: sourceText } : {}) };
}

const normalized = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");

/** Append in order and merge repeated cross-part lessons without duplicating cards or questions. */
export function mergeUnits(prev: DraftUnit[], next: DraftUnit[]): DraftUnit[] {
  const out = prev.map((u) => ({ ...u, lessons: u.lessons.map((l) => ({ ...l })) }));
  for (const u of next) {
    let target = out[out.length - 1];
    if (!target || normalized(target.title) !== normalized(u.title ?? "")) {
      target = { ...u, lessons: [] };
      out.push(target);
    }
    for (const incoming of u.lessons ?? []) {
      const index = target.lessons.findIndex((l) => normalized(l.title) === normalized(incoming.title ?? ""));
      if (index < 0) {
        target.lessons.push({ ...incoming });
        continue;
      }
      const existing = target.lessons[index]!;
      if (!incoming.source_text) continue;
      const sources = [...new Set([existing.source_text, incoming.source_text].filter((s): s is string => !!s))];
      const combined = sources.join("\n\n");
      if (combined !== existing.source_text) target.lessons[index] = emptyDraftLesson(existing.title, combined);
      else target.lessons[index] = { ...existing, source_text: combined };
    }
  }
  return out;
}

export const countLessons = (units: DraftUnit[]) => units.reduce((n, u) => n + u.lessons.length, 0);

export type LessonStage = "content" | "flashcards" | "quiz";
export function missingLessonStages(lesson: DraftLesson): LessonStage[] {
  const missing: LessonStage[] = [];
  if (!lesson.explanation?.trim() || !lesson.summary?.trim() || !(lesson.key_points?.length > 0)) missing.push("content");
  if (lesson.flashcards?.length !== 15) missing.push("flashcards");
  if (lesson.quiz?.length !== 15) missing.push("quiz");
  return missing;
}

/** A book is complete only when every lesson has all required, unique generated material. */
export function bookCompletenessErrors(units: DraftUnit[]): string[] {
  const errors: string[] = [];
  for (const unit of units) {
    const titles = new Set<string>();
    for (const lesson of unit.lessons) {
      const key = normalized(lesson.title);
      if (titles.has(key)) errors.push(`${unit.title} / ${lesson.title}: درس مكرر`);
      titles.add(key);
      const missing = missingLessonStages(lesson);
      if (missing.length) errors.push(`${unit.title} / ${lesson.title}: نواقص ${missing.join("، ")}`);
      if (new Set((lesson.flashcards ?? []).map((f) => normalized(f.front))).size !== lesson.flashcards?.length) errors.push(`${lesson.title}: بطاقات مكررة`);
      if (new Set((lesson.quiz ?? []).map((q) => normalized(q.question.replace(/^\s*\d+[.)\-]?\s*/, "")))).size !== lesson.quiz?.length) errors.push(`${lesson.title}: أسئلة مكررة`);
    }
  }
  return errors;
}
