export type ProgressLesson = { id: string };
export type ProgressUnit = { id: string; lessons: ProgressLesson[] };

export function completionPercent(lessonIds: string[], completedLessons: string[]) {
  const published = new Set(lessonIds);
  if (!published.size) return 0;
  const completed = new Set(completedLessons);
  let done = 0;
  for (const id of published) if (completed.has(id)) done++;
  return Math.round((done / published.size) * 100);
}

export function subjectCompletion(units: ProgressUnit[], completedLessons: string[]) {
  return completionPercent(units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)), completedLessons);
}

export function unitCompletion(unit: ProgressUnit, completedLessons: string[]) {
  return completionPercent(unit.lessons.map((lesson) => lesson.id), completedLessons);
}
