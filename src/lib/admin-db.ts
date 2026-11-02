import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DraftContent } from "@/lib/admin-ai.functions";

export type AdminDraft = {
  id: string;
  stage_id: string | null;
  grade_id: string | null;
  subject_id: string | null;
  source_name: string;
  source_text: string;
  content: DraftContent;
  flags: string[];
  status: string;
  created_at: string;
  published_at: string | null;
};

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [stages, grades, subjects, units, lessons, users, subs, drafts, refs] = await Promise.all([
        supabase.from("stages").select("id", { count: "exact", head: true }),
        supabase.from("grades").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("curriculum_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return {
        stages: stages.count ?? 0,
        grades: grades.count ?? 0,
        subjects: subjects.count ?? 0,
        units: units.count ?? 0,
        lessons: lessons.count ?? 0,
        users: users.count ?? 0,
        subs: subs.count ?? 0,
        drafts: drafts.count ?? 0,
        referrals: refs.count ?? 0,
      };
    },
  });
}

export function useAdminList<T = Record<string, unknown>>(
  table: "stages" | "grades" | "subjects" | "units" | "lessons",
  filter?: { column: string; value: string | null },
) {
  return useQuery({
    queryKey: ["admin", table, filter?.column ?? "", filter?.value ?? ""],
    enabled: !filter || !!filter.value,
    queryFn: async (): Promise<T[]> => {
      let q = supabase.from(table).select("*").order("sort_order");
      if (filter?.value) q = q.eq(filter.column, filter.value);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useAdminMutation(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: { type: "insert" | "update" | "delete"; id?: string; values?: Record<string, unknown> }) => {
      const t = supabase.from(table as "stages");
      if (op.type === "insert") {
        const { error } = await t.insert(op.values as never);
        if (error) throw error;
      } else if (op.type === "update") {
        const { error } = await t.update(op.values as never).eq("id", op.id!);
        if (error) throw error;
      } else {
        const { error } = await t.delete().eq("id", op.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id,display_name,email,grade_id,avatar_emoji,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search.trim()) q = q.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      const [{ data: roles }, { data: subs }, { data: stats }] = await Promise.all([
        supabase.from("user_roles").select("user_id,role").in("user_id", ids.length ? ids : ["-"]),
        supabase
          .from("subscriptions")
          .select("user_id,status,expires_at,plan")
          .in("user_id", ids.length ? ids : ["-"])
          .eq("status", "active"),
        supabase.from("user_stats").select("user_id,points,streak").in("user_id", ids.length ? ids : ["-"]),
      ]);
      return (data ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
        sub: (subs ?? []).find((s) => s.user_id === p.id) ?? null,
        stats: (stats ?? []).find((s) => s.user_id === p.id) ?? null,
      }));
    },
  });
}

export function useDrafts(status?: string) {
  return useQuery({
    queryKey: ["admin", "drafts", status ?? "all"],
    queryFn: async (): Promise<AdminDraft[]> => {
      let q = supabase.from("curriculum_drafts").select("*").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminDraft[];
    },
  });
}

export function useSettingsMap() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key,value");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        const v = row.value as unknown;
        map[row.key] = typeof v === "string" ? v : JSON.stringify(v);
      }
      return map;
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | number }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value as never, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });
}

/** Publishes an approved draft into the live curriculum tables. */
export async function publishDraft(draft: AdminDraft) {
  if (!draft.subject_id) throw new Error("اختر المادة أولًا");
  const { data: existing } = await supabase
    .from("units")
    .select("sort_order")
    .eq("subject_id", draft.subject_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  let unitOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  for (const unit of draft.content.units ?? []) {
    const { data: u, error: ue } = await supabase
      .from("units")
      .insert({
        subject_id: draft.subject_id,
        title: unit.title,
        description: unit.description ?? "",
        sort_order: unitOrder++,
        published: true,
      })
      .select("id")
      .single();
    if (ue) throw ue;

    let lessonOrder = 1;
    for (const lesson of unit.lessons ?? []) {
      const { data: l, error: le } = await supabase
        .from("lessons")
        .insert({
          unit_id: u.id,
          title: lesson.title,
          duration_minutes: Math.max(1, Math.round(lesson.duration_minutes || 10)),
          sort_order: lessonOrder++,
          published: true,
        })
        .select("id")
        .single();
      if (le) throw le;

      await supabase.from("lesson_content").insert({
        lesson_id: l.id,
        explanation: lesson.explanation ?? "",
        key_points: (lesson.key_points ?? []) as never,
        summary: lesson.summary ?? "",
        key_terms: (lesson.key_terms ?? []) as never,
        review_material: lesson.review_material ?? "",
      });

      if (lesson.flashcards?.length) {
        await supabase.from("flashcards").insert(
          lesson.flashcards.map((f, i) => ({
            lesson_id: l.id,
            front: f.front,
            back: f.back,
            sort_order: i + 1,
          })),
        );
      }
      if (lesson.quiz?.length) {
        await supabase.from("quiz_questions").insert(
          lesson.quiz.map((q, i) => ({
            lesson_id: l.id,
            question: q.question,
            options: q.options as never,
            correct_index: Math.min(Math.max(q.correct_index ?? 0, 0), (q.options?.length ?? 1) - 1),
            explanation: q.explanation ?? "",
            sort_order: i + 1,
          })),
        );
      }
    }
  }

  const { error } = await supabase
    .from("curriculum_drafts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", draft.id);
  if (error) throw error;
}
