import { supabase } from "@/integrations/supabase/client";

export type TourStep = {
  id: string;
  step_key: string;
  target_id: string;
  page: string;
  page_label: string;
  title: string;
  body: string;
  default_title: string;
  default_body: string;
  sort_order: number;
  enabled: boolean;
  updated_at: string;
};

export async function fetchTourSteps(): Promise<TourStep[]> {
  const { data, error } = await supabase.from("tour_steps").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as TourStep[];
}

/** Only enabled steps, in saved order — what students see. */
export function activeTourSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((s) => s.enabled).sort((a, b) => a.sort_order - b.sort_order);
}
