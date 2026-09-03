import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type AppState = {
  name: string;
  email: string;
  stageId: string | null;
  gradeId: string | null;
  dark: boolean;
  completedLessons: string[];
  streak: number;
  points: number;
};

const DEFAULT: AppState = {
  name: "",
  email: "",
  stageId: null,
  gradeId: null,
  dark: false,
  completedLessons: [],
  streak: 7,
  points: 1240,
};

const KEY = "bunny-app-state";

type Ctx = {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  toggleLesson: (id: string) => void;
  reset: () => void;
  hydrated: boolean;
};

const AppContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(state));
    document.documentElement.classList.toggle("dark", state.dark);
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);

  const toggleLesson = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        completedLessons: s.completedLessons.includes(id)
          ? s.completedLessons.filter((x) => x !== id)
          : [...s.completedLessons, id],
        points: s.completedLessons.includes(id) ? s.points : s.points + 25,
      })),
    [],
  );

  const reset = useCallback(() => setState(DEFAULT), []);

  return (
    <AppContext.Provider value={{ state, update, toggleLesson, reset, hydrated }}>{children}</AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
