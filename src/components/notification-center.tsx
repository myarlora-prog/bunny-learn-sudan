import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";

type Notice = { id: string; title: string; content: string };

/** Polls account notifications so referral updates appear without reloading or signing out. */
export function NotificationCenter() {
  const { session, state } = useApp();
  const uid = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const shown = useRef(new Set<string>());
  const notices = useQuery({
    queryKey: ["account-notifications", uid],
    enabled: !!uid && state.notifications,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_notifications").select("id,title,content").is("read_at", null).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });

  useEffect(() => {
    const fresh = (notices.data ?? []).filter((n) => !shown.current.has(n.id));
    if (!fresh.length) return;
    for (const notice of fresh.reverse()) {
      shown.current.add(notice.id);
      toast(notice.title, { description: notice.content });
    }
    void supabase.rpc("mark_notifications_read").then(() => queryClient.invalidateQueries({ queryKey: ["account-notifications", uid] }));
  }, [notices.data, queryClient, uid]);

  return null;
}
