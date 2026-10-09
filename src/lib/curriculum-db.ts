import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DbStage = { id: string; name: string; description: string | null; sort_order: number };
export type DbGrade = {
  id: string;
  stage_id: string;
  name: string;
  access_type: string;
  sort_order: number;
};
export type DbSubject = {
  id: string;
  grade_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
};

export function useStages() {
  return useQuery({
    queryKey: ["stages"],
    queryFn: async (): Promise<DbStage[]> => {
      const { data, error } = await supabase
        .from("stages")
        .select("id,name,description,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGrades(stageId: string | null) {
  return useQuery({
    queryKey: ["grades", stageId],
    enabled: !!stageId,
    queryFn: async (): Promise<DbGrade[]> => {
      const { data, error } = await supabase
        .from("grades")
        .select("id,stage_id,name,access_type,sort_order")
        .eq("stage_id", stageId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubjects(gradeId: string | null) {
  return useQuery({
    queryKey: ["subjects", gradeId],
    enabled: !!gradeId,
    queryFn: async (): Promise<DbSubject[]> => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id,grade_id,name,icon,color,sort_order")
        .eq("grade_id", gradeId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* --------- Live curriculum (published) mapped to the existing UI shapes --------- */

import type { Subject as UiSubject, Lesson as UiLesson, Unit as UiUnit } from "@/data/curriculum";

export const isDbId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Full published unit/lesson tree for one subject, in the shape the subject page already renders. */
export function useSubjectTree(subjectId: string | null) {
  return useQuery({
    queryKey: ["subject-tree", subjectId],
    enabled: !!subjectId && isDbId(subjectId ?? ""),
    queryFn: async (): Promise<UiSubject | null> => {
      const { data: subject, error } = await supabase
        .from("subjects")
        .select("id,name,icon,color")
        .eq("id", subjectId!)
        .maybeSingle();
      if (error) throw error;
      if (!subject) return null;

      const { data: units } = await supabase
        .from("units")
        .select("id,title,sort_order,published")
        .eq("subject_id", subject.id)
        .eq("published", true)
        .order("sort_order");

      const unitIds = (units ?? []).map((u) => u.id);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,unit_id,title,duration_minutes,sort_order,published")
        .in("unit_id", unitIds.length ? unitIds : ["-"])
        .eq("published", true)
        .order("sort_order");

      const uiUnits: UiUnit[] = (units ?? []).map((u) => ({
        id: u.id,
        title: u.title,
        lessons: (lessons ?? [])
          .filter((l) => l.unit_id === u.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            minutes: l.duration_minutes,
            explanation: [],
            summary: [],
            flashcards: [],
            quiz: [],
          })),
      }));

      return {
        id: subject.id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
        progress: 0,
        units: uiUnits,
      };
    },
  });
}

/** Concatenated published lesson content for a subject — the source text for AI subject exams. */
export function useSubjectExamSource(subjectId: string | null) {
  return useQuery({
    queryKey: ["subject-exam-source", subjectId],
    enabled: !!subjectId && isDbId(subjectId ?? ""),
    queryFn: async (): Promise<string> => {
      const { data: units } = await supabase
        .from("units")
        .select("id,title")
        .eq("subject_id", subjectId!)
        .eq("published", true)
        .order("sort_order");
      const unitIds = (units ?? []).map((u) => u.id);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,unit_id,title")
        .in("unit_id", unitIds.length ? unitIds : ["-"])
        .eq("published", true)
        .order("sort_order");
      const lessonIds = (lessons ?? []).map((l) => l.id);
      const { data: contents } = await supabase
        .from("lesson_content")
        .select("lesson_id,explanation,summary,key_points")
        .in("lesson_id", lessonIds.length ? lessonIds : ["-"]);
      const byLesson = new Map((contents ?? []).map((c) => [c.lesson_id, c]));
      const unitTitle = new Map((units ?? []).map((u) => [u.id, u.title]));
      return (lessons ?? [])
        .map((l) => {
          const c = byLesson.get(l.id);
          const parts = [
            `## ${unitTitle.get(l.unit_id) ?? ""} - ${l.title}`,
            String(c?.explanation ?? ""),
            String(c?.summary ?? ""),
            Array.isArray(c?.key_points) ? (c.key_points as unknown as string[]).join("\n") : "",
          ];
          return parts.filter(Boolean).join("\n");
        })
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 60000);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** One published lesson with its content, flashcards and quiz, in the existing lesson-page shape. */
export function useLessonData(lessonId: string | null) {
  return useQuery({
    queryKey: ["lesson", lessonId],
    enabled: !!lessonId && isDbId(lessonId ?? ""),
    queryFn: async (): Promise<{ lesson: UiLesson; subject: UiSubject; unit: UiUnit } | null> => {
      const { data: lesson, error } = await supabase
        .from("lessons")
        .select("id,title,duration_minutes,published,units(id,title,subjects(id,name,icon,color))")
        .eq("id", lessonId!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      if (!lesson?.units?.subjects) return null;

      const [{ data: content }, { data: cards }, { data: quiz }] = await Promise.all([
        supabase
          .from("lesson_content")
          .select("explanation,key_points,summary")
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
        supabase.from("flashcards").select("front,back,sort_order").eq("lesson_id", lesson.id).order("sort_order"),
        supabase
          .from("quiz_questions")
          .select("question,options,correct_index,explanation,sort_order")
          .eq("lesson_id", lesson.id)
          .order("sort_order"),
      ]);

      const keyPoints = Array.isArray(content?.key_points) ? (content!.key_points as unknown as string[]) : [];
      const explanationText = String(content?.explanation ?? "");

      return {
        lesson: {
          id: lesson.id,
          title: lesson.title,
          minutes: lesson.duration_minutes,
          explanation: explanationText
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean),
          summary: [
            ...keyPoints.map(String),
            ...(content?.summary ? [String(content.summary)] : []),
          ],
          flashcards: (cards ?? []).map((c) => ({ q: c.front, a: c.back })),
          quiz: (quiz ?? []).map((q) => ({
            q: q.question,
            options: (q.options as unknown as string[]) ?? [],
            correct: q.correct_index,
            hint: q.explanation,
          })),
        },
        subject: {
          id: lesson.units.subjects.id,
          name: lesson.units.subjects.name,
          icon: lesson.units.subjects.icon,
          color: lesson.units.subjects.color,
          progress: 0,
          units: [],
        },
        unit: { id: lesson.units.id, title: lesson.units.title, lessons: [] },
      };
    },
  });
}
