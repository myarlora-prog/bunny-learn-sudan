import type { ExamQuestion } from "@/lib/exam.functions";

export function splitExamSource(text: string, size = 16000): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > size) {
    const boundary = remaining.lastIndexOf("\n", size);
    const end = boundary > size / 2 ? boundary + 1 : size;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function validExamQuestions(value: unknown): value is ExamQuestion[] {
  return Array.isArray(value) && value.length > 0 && value.every((q) =>
    q && typeof q.q === "string" && q.q.trim() && Array.isArray(q.options) && q.options.length === 4 &&
    q.options.every((o: unknown) => typeof o === "string" && o.trim()) && Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3);
}