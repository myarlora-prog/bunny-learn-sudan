import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; free_access: boolean; sort_order: number };
type UnitRow = { id: string; title: string; sort_order: number; lessons: Row[] };
type SubjectRow = { id: string; name: string; icon: string; grade: string; units: UnitRow[] };

const ghost = "press rounded-2xl border border-border bg-card px-3 py-1.5 text-[11px] font-bold";

function useAccessTree() {
  return useQuery({
    queryKey: ["admin-lesson-access"],
    queryFn: async (): Promise<SubjectRow[]> => {
      const [{ data: subjects, error }, { data: units }, { data: lessons }] = await Promise.all([
        supabase.from("subjects").select("id,name,icon,sort_order,grades(name,sort_order)").order("sort_order"),
        supabase.from("units").select("id,subject_id,title,sort_order").order("sort_order"),
        supabase.from("lessons").select("id,unit_id,title,free_access,sort_order").order("sort_order"),
      ]);
      if (error) throw error;
      return (subjects ?? [])
        .map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          grade: (s.grades as { name: string } | null)?.name ?? "",
          gradeOrder: (s.grades as { sort_order: number } | null)?.sort_order ?? 0,
          units: (units ?? [])
            .filter((u) => u.subject_id === s.id)
            .map((u) => ({ ...u, lessons: (lessons ?? []).filter((l) => l.unit_id === u.id) })),
        }))
        .filter((s) => s.units.some((u) => u.lessons.length))
        .sort((a, b) => a.gradeOrder - b.gradeOrder);
    },
  });
}

/** Owner control of which lessons Free students can open. Writes are protected by admin-only database policies. */
export function AdminLessonAccess() {
  const { data, isLoading } = useAccessTree();
  const qc = useQueryClient();
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const setAccess = useMutation({
    mutationFn: async ({ ids, open }: { ids: string[]; open: boolean }) => {
      const { error } = await supabase.from("lessons").update({ free_access: open }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-lesson-access"] });
      void qc.invalidateQueries({ queryKey: ["subject-tree"] });
      toast.success("تم حفظ الإتاحة");
    },
    onError: () => toast.error("تعذّر الحفظ"),
  });

  const bulk = (ids: string[], open: boolean, scope: string) => {
    if (!ids.length) return;
    const msg = `${open ? "فتح" : "قفل"} ${ids.length} درس في ${scope} لمستخدمي Free؟`;
    if (window.confirm(msg)) setAccess.mutate({ ids, open });
  };

  const filtered = useMemo(
    () => (data ?? []).filter((s) => !q || s.name.includes(q) || s.grade.includes(q)),
    [data, q],
  );

  if (isLoading) return <Loader2 className="mx-auto my-6 size-5 animate-spin text-primary" />;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث بالمادة أو الصف"
        className="w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">لا توجد دروس بعد.</p>}
      {filtered.map((s) => {
        const all = s.units.flatMap((u) => u.lessons.map((l) => l.id));
        const openCount = s.units.flatMap((u) => u.lessons).filter((l) => l.free_access).length;
        const expanded = openSubject === s.id;
        return (
          <Card key={s.id} className="p-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-right"
              onClick={() => setOpenSubject(expanded ? null : s.id)}
            >
              <span className="text-xl">{s.icon}</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold">{s.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {s.grade} · مفتوح {openCount} من {all.length}
                </p>
              </div>
            </button>
            {expanded && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <button className={ghost} onClick={() => bulk(all, true, "المادة")}>فتح المادة كاملة</button>
                  <button className={ghost} onClick={() => bulk(all, false, "المادة")}>قفل المادة كاملة</button>
                </div>
                {s.units.map((u) => {
                  const ids = u.lessons.map((l) => l.id);
                  return (
                    <div key={u.id} className="rounded-2xl border border-border p-2.5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="flex-1 text-xs font-bold">{u.title}</h4>
                        <button className={ghost} onClick={() => bulk(ids, true, "الوحدة")}>فتح الوحدة</button>
                        <button className={ghost} onClick={() => bulk(ids, false, "الوحدة")}>قفل الوحدة</button>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {u.lessons.map((l) => (
                          <div key={l.id} className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs">{l.title}</span>
                            <button
                              type="button"
                              disabled={setAccess.isPending}
                              onClick={() => setAccess.mutate({ ids: [l.id], open: !l.free_access })}
                              className={cn(
                                "press inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold",
                                l.free_access ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {l.free_access ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                              {l.free_access ? "مفتوح لمستخدمي Free" : "مقفول لمستخدمي Free"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
