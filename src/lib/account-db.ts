import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReferralSummary = {
  code: string;
  goal: number;
  count: number;
  reward_granted: boolean;
  friends: { name: string; status: string; date: string }[];
};

export type Hero = {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  points: number;
  rank: number;
};

export function useReferralSummary(enabled = true) {
  return useQuery({
    queryKey: ["referral-summary"],
    enabled,
    queryFn: async (): Promise<ReferralSummary> => {
      const { data, error } = await supabase.rpc("referral_summary");
      if (error) throw error;
      return data as unknown as ReferralSummary;
    },
  });
}

export function useHeroes(enabled = true) {
  return useQuery({
    queryKey: ["heroes"],
    enabled,
    queryFn: async (): Promise<Hero[]> => {
      const { data, error } = await supabase.rpc("grade_champions");
      if (error) throw error;
      return (data ?? []) as Hero[];
    },
  });
}

export function useSetting(key: string) {
  return useQuery({
    queryKey: ["setting", key],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
      const v = data?.value;
      return typeof v === "string" ? v : v == null ? null : String(v);
    },
  });
}
