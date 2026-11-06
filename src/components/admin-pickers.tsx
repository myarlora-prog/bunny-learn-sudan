import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Table = "stages" | "grades" | "subjects" | "units" | "lessons";
type Row = { id: string; name?: string; title?: string; icon?: string };

const PARENT: Record<Table, string | null> = { stages: null, grades: "stage_id", subjects: "grade_id", units: "subject_id", lessons: "unit_id" };

export function useCurriculumLevel(table: Table, parentId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["admin-level", table, parentId],
    enabled: enabled && (PARENT[table] === null || !!parentId),
    queryFn: async (): Promise<Row[]> => {
      const cols = table === "units" || table === "lessons" ? "id,title" : table === "subjects" ? "id,name,icon" : "id,name";
      let q = supabase.from(table).select(cols).order("sort_order");
      const p = PARENT[table];
      if (p && parentId) q = q.eq(p, parentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
}

/** Owner-side list of one curriculum level, each row opening the next step. */
export function LevelList({ table, parentId, onPick, empty }: { table: Table; parentId: string | null; onPick: (r: Row) => void; empty: string }) {
  const q = useCurriculumLevel(table, parentId);
  if (q.isLoading) return <Loader2 className="mx-auto my-6 size-6 animate-spin text-primary" />;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <button key={r.id} type="button" onClick={() => onPick(r)} className="surface-card press flex items-center gap-3 p-4 text-right">
          {r.icon && <span className="text-xl">{r.icon}</span>}
          <span className="flex-1 text-sm font-bold">{r.name ?? r.title}</span>
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

export const rowLabel = (r: Row) => r.name ?? r.title ?? "";
