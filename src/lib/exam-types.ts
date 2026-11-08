export const QUESTION_TYPES = {
  choice: "اختيار من متعدد", true_false: "صح أو خطأ", blank: "أكمل الفراغ",
  direct: "سؤال مباشر", definition: "تعريف ومصطلح", comparison: "مقارنة",
  enumeration: "تعداد", application: "فهم وتطبيق", connection: "ربط المعلومات",
} as const;
export type QuestionType = keyof typeof QUESTION_TYPES;
/** Missing type denotes the original published multiple-choice format. */
export type ExamQuestion = { type?: QuestionType; q: string; options: string[]; correct: number; hint: string; answer?: string; acceptedAnswers?: string[]; lessonId?: string; difficulty?: "easy" | "medium" | "hard" };
export const isChoice = (q: ExamQuestion) => !q.type || q.type === "choice" || q.type === "true_false";
export function validQuestion(value: unknown): value is ExamQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  if (typeof q.q !== "string" || !q.q.trim() || typeof q.hint !== "string") return false;
  if (q.type !== undefined && (typeof q.type !== "string" || !(q.type in QUESTION_TYPES))) return false;
  if (!Array.isArray(q.options) || !Number.isInteger(q.correct)) return false;
  if (q.type === undefined || q.type === "choice" || q.type === "true_false") {
    const expected = q.type === "true_false" ? 2 : 4;
    return q.options.length === expected && q.options.every((o) => typeof o === "string" && o.trim()) && typeof q.correct === "number" && q.correct >= 0 && q.correct < expected;
  }
  return q.options.length === 0 && typeof q.answer === "string" && !!q.answer.trim() && q.correct === 0;
}
export function normalizeAnswer(text: string) {
  return text.normalize("NFKC").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/[.,،؛:!?؟]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
export function uniqueQuestions(questions: ExamQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((q) => { const key = normalizeAnswer(q.q); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function matchesAnswer(q: ExamQuestion, value: string) {
  const input = normalizeAnswer(value);
  return !!input && [q.answer ?? "", ...(q.acceptedAnswers ?? [])].some((a) => normalizeAnswer(a) === input);
}