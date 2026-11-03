import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, get, set, del } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { fetchGradeSubjectIds, fetchLessonData, fetchSubjectTree } from "@/lib/curriculum-db";

const WEEK = 1000 * 60 * 60 * 24 * 30;

/** Persist the React Query cache (curriculum content) to IndexedDB so it survives offline restarts. */
export function setupPersistence(queryClient: QueryClient) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return () => {};
  const store = createStore("nawabig", "query-cache");
  const persister = createAsyncStoragePersister({
    storage: {
      getItem: (k) => get(k, store),
      setItem: (k, v) => set(k, v, store),
      removeItem: (k) => del(k, store),
    },
    throttleTime: 2000,
  });
  const [unsubscribe] = persistQueryClient({
    queryClient,
    persister,
    maxAge: WEEK,
    buster: "nawabig-v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (q) =>
        q.state.status === "success" &&
        ["subject-tree", "lesson", "subjects", "stages", "grades", "subject-quiz-counts", "week-activity", "setting"].includes(
          String(q.queryKey[0]),
        ),
    },
  });
  return unsubscribe;
}

/** Download every subject + lesson of the student's grade in the background. Old cache stays on failure. */
export async function syncGradeContent(queryClient: QueryClient, gradeId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const subjectIds = await fetchGradeSubjectIds(gradeId);
    for (const sid of subjectIds) {
      const tree = await queryClient.fetchQuery({
        queryKey: ["subject-tree", sid],
        queryFn: () => fetchSubjectTree(sid),
        staleTime: 0,
      });
      for (const unit of tree?.units ?? []) {
        for (const l of unit.lessons) {
          await queryClient
            .fetchQuery({ queryKey: ["lesson", l.id], queryFn: () => fetchLessonData(l.id), staleTime: 0 })
            .catch(() => undefined);
        }
      }
    }
  } catch {
    /* keep existing local content */
  }
}

/* ---------------- pending progress queue (offline completions) ---------------- */

const QUEUE_KEY = "nawabig-pending-lessons";
type Pending = { lessonId: string; at: string };

export function readPending(): Pending[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as Pending[];
  } catch {
    return [];
  }
}

function writePending(list: Pending[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export function queueLesson(lessonId: string) {
  const list = readPending();
  if (!list.some((p) => p.lessonId === lessonId)) {
    list.push({ lessonId, at: new Date().toISOString() });
    writePending(list);
  }
}

/** Send queued completions. complete_lesson is idempotent server-side, so retries never duplicate. */
export async function flushPending(): Promise<number> {
  const list = readPending();
  if (!list.length || (typeof navigator !== "undefined" && !navigator.onLine)) return 0;
  const left: Pending[] = [];
  let sent = 0;
  for (const p of list) {
    const { error } = await supabase.rpc("complete_lesson", { _lesson_id: p.lessonId });
    if (error) left.push(p);
    else sent++;
  }
  writePending(left);
  return sent;
}
