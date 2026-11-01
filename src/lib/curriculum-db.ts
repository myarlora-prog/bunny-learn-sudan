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
