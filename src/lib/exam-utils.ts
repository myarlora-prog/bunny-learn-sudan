import { validQuestion, type ExamQuestion } from "@/lib/exam-types";

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
  return Array.isArray(value) && value.length > 0 && value.every(validQuestion);
}