import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WeekActivity = {
  /** Local date keys (YYYY-MM-DD) for the current week, Saturday first. */
  days: { key: string; label: string; lessons: number; quizzes: number }[];
  lessons: { id: string; title: string; at: string }[];
  totalLessons: number;
  totalQuizzes: number;
};

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Start of the current study week (Saturday) in the student's local time. */
export function weekStart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getDay() + 1) % 7; // Saturday => 0
  d.setDate(d.getDate() - diff);
  return d;
}

/** Real lesson completions and quiz attempts of the current week, refreshed whenever progress changes. */
export function useWeekActivity(uid: string | null, completedCount: number) {
  return useQuery({
    queryKey: ["week-activity", uid, completedCount],
    enabled: !!uid,
    queryFn: async (): Promise<WeekActivity> => {
      const start = weekStart();
      const [{ data: progress }, { data: quizzes }] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select("lesson_id,completed_at,lessons(title)")
          .eq("user_id", uid!)
          .gte("completed_at", start.toISOString())
          .order("completed_at"),
        supabase.from("quiz_attempts").select("created_at").eq("user_id", uid!).gte("created_at", start.toISOString()),
      ]);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return { key: localKey(d), label: DAY_LABELS[d.getDay()]!, lessons: 0, quizzes: 0 };
      });
      const byKey = new Map(days.map((d) => [d.key, d]));
      for (const p of progress ?? []) {
        const day = byKey.get(localKey(new Date(p.completed_at)));
        if (day) day.lessons++;
      }
      for (const q of quizzes ?? []) {
        const day = byKey.get(localKey(new Date(q.created_at)));
        if (day) day.quizzes++;
      }
      return {
        days,
        lessons: (progress ?? []).map((p) => ({
          id: p.lesson_id,
          title: (p.lessons as { title: string } | null)?.title ?? "",
          at: p.completed_at,
        })),
        totalLessons: progress?.length ?? 0,
        totalQuizzes: quizzes?.length ?? 0,
      };
    },
  });
}
