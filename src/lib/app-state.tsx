import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type EnergyState = {
  daily_max: number;
  daily_left: number;
  regen_max: number;
  regen_left: number;
  available: number;
  regen_interval_minutes: number;
  next_regen_at: string | null;
  exhausted: boolean;
};

type AppState = {
  name: string;
  email: string;
  stageId: string | null;
  gradeId: string | null;
  dark: boolean;
  completedLessons: string[];
  streak: number;
  points: number;
  studyDays: number;
  totalMinutes: number;
  avatar: string;
  referralCode: string | null;
};

const DEFAULT: AppState = {
  name: "",
  email: "",
  stageId: null,
  gradeId: null,
  dark: false,
  completedLessons: [],
  streak: 0,
  points: 0,
  studyDays: 0,
  totalMinutes: 0,
  avatar: "🦅",
  referralCode: null,
};

export type Subscription = {
  plan: string;
  status: string;
  expires_at: string;
  grade_id: string;
};

type Ctx = {
  state: AppState;
  session: Session | null;
  isAdmin: boolean;
  subscription: Subscription | null;
  isSuper: boolean;
  energy: EnergyState | null;
  hydrated: boolean;
  update: (patch: Partial<AppState>) => void;
  toggleLesson: (id: string) => Promise<void>;
  refreshEnergy: () => Promise<EnergyState | null>;
  spendEnergy: (amount?: number) => Promise<{ ok: boolean; state: EnergyState | null }>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
};

const AppContext = createContext<Ctx | null>(null);
const DARK_KEY = "saqro-dark";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // dark mode is a device preference, kept locally so it applies before login
  useEffect(() => {
    const raw = localStorage.getItem(DARK_KEY);
    if (raw) setState((s) => ({ ...s, dark: raw === "1" }));
  }, []);

  useEffect(() => {
    localStorage.setItem(DARK_KEY, state.dark ? "1" : "0");
    document.documentElement.classList.toggle("dark", state.dark);
  }, [state.dark]);

  const loadUser = useCallback(async (uid: string | null) => {
    if (!uid) {
      setState((s) => ({ ...DEFAULT, dark: s.dark }));
      setIsAdmin(false);
      setSubscription(null);
      setEnergy(null);
      setHydrated(true);
      return;
    }
    const [profile, stats, progress, settings, admin, energyRes, sub] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_stats").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", uid),
      supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
      supabase.rpc("is_admin"),
      supabase.rpc("energy_state"),
      supabase
        .from("subscriptions")
        .select("plan,status,expires_at,grade_id")
        .eq("user_id", uid)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setSubscription((sub.data as Subscription | null) ?? null);

    setIsAdmin(admin.data === true);
    setEnergy((energyRes.data as unknown as EnergyState) ?? null);
    setState((s) => ({
      ...s,
      name: profile.data?.display_name || "",
      email: profile.data?.email || "",
      stageId: profile.data?.stage_id ?? null,
      gradeId: profile.data?.grade_id ?? null,
      avatar: profile.data?.avatar_emoji || "🦅",
      referralCode: profile.data?.referral_code ?? null,
      dark: settings.data?.dark_mode ?? s.dark,
      streak: stats.data?.streak ?? 0,
      points: stats.data?.points ?? 0,
      studyDays: stats.data?.study_days ?? 0,
      totalMinutes: stats.data?.total_minutes ?? 0,
      completedLessons: (progress.data ?? []).map((p) => p.lesson_id),
    }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadUser(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void loadUser(s?.user.id ?? null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUser]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadUser(data.session?.user.id ?? null);
  }, [loadUser]);

  const update = useCallback(
    (patch: Partial<AppState>) => {
      setState((s) => ({ ...s, ...patch }));
      const uid = session?.user.id;
      if (!uid) return;
      const profilePatch: {
        display_name?: string;
        stage_id?: string | null;
        grade_id?: string | null;
        avatar_emoji?: string;
      } = {};
      if (patch.name !== undefined) profilePatch.display_name = patch.name;
      if (patch.stageId !== undefined) profilePatch.stage_id = patch.stageId;
      if (patch.gradeId !== undefined) profilePatch.grade_id = patch.gradeId;
      if (patch.avatar !== undefined) profilePatch.avatar_emoji = patch.avatar;
      if (Object.keys(profilePatch).length) {
        void supabase.from("profiles").update(profilePatch).eq("id", uid);
      }
      if (patch.dark !== undefined) {
        void supabase.from("user_settings").upsert({ user_id: uid, dark_mode: patch.dark });
      }
    },
    [session],
  );

  const toggleLesson = useCallback(
    async (id: string) => {
      if (!session) return;
      if (state.completedLessons.includes(id)) return;
      const { error } = await supabase.rpc("complete_lesson", { _lesson_id: id });
      if (error) return;
      await refresh();
    },
    [session, state.completedLessons, refresh],
  );

  const refreshEnergy = useCallback(async () => {
    if (!session) return null;
    const { data } = await supabase.rpc("energy_state");
    const next = (data as unknown as EnergyState) ?? null;
    setEnergy(next);
    return next;
  }, [session]);

  const spendEnergy = useCallback(
    async (amount = 1) => {
      if (!session) return { ok: false, state: null };
      if (subscription) return { ok: true, state: energy };
      const { data, error } = await supabase.rpc("spend_energy", { _amount: amount });
      if (error) return { ok: false, state: energy };
      const res = data as unknown as { ok: boolean; state: EnergyState };
      setEnergy(res.state);
      return { ok: res.ok, state: res.state };
    },
    [session, energy, subscription],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState((s) => ({ ...DEFAULT, dark: s.dark }));
    setEnergy(null);
    setIsAdmin(false);
    setSubscription(null);
  }, []);

  const reset = useCallback(() => setState((s) => ({ ...DEFAULT, dark: s.dark })), []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      session,
      isAdmin,
      subscription,
      isSuper: !!subscription,
      energy,
      hydrated,
      update,
      toggleLesson,
      refreshEnergy,
      spendEnergy,
      refresh,
      signOut,
      reset,
    }),
    [state, session, isAdmin, subscription, energy, hydrated, update, toggleLesson, refreshEnergy, spendEnergy, refresh, signOut, reset],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
