import { supabase } from "@/integrations/supabase/client";

export type SubjectLesson = {
  id: string; title: string; unitId: string; unitTitle: string;
  explanation: string; summary: string; keyPoints: string[]; flashcards: { front: string; back: string }[];
};

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").trim();

/** Ordered lessons of one subject with their saved content. `publishedOnly` limits to student-visible units/lessons. */
export async function loadSubjectLessons(subjectId: string, publishedOnly: boolean): Promise<SubjectLesson[]> {
  let uq = supabase.from("units").select("id,title,sort_order").eq("subject_id", subjectId).order("sort_order");
  if (publishedOnly) uq = uq.eq("published", true);
  const { data: units, error: ue } = await uq;
  if (ue) throw ue;
  if (!units?.length) return [];
  let lq = supabase.from("lessons").select("id,title,unit_id,sort_order").in("unit_id", units.map((u) => u.id)).order("sort_order");
  if (publishedOnly) lq = lq.eq("published", true);
  const { data: lessons, error: le } = await lq;
  if (le) throw le;
  const ids = (lessons ?? []).map((l) => l.id);
  if (!ids.length) return [];
  const [{ data: content, error: ce }, { data: cards, error: fe }] = await Promise.all([
    supabase.from("lesson_content").select("lesson_id,explanation,summary,key_points").in("lesson_id", ids),
    supabase.from("flashcards").select("lesson_id,front,back,sort_order").in("lesson_id", ids).order("sort_order"),
  ]);
  if (ce) throw ce;
  if (fe) throw fe;
  const unitOrder = new Map(units.map((u, i) => [u.id, i]));
  return (lessons ?? [])
    .slice()
    .sort((a, b) => (unitOrder.get(a.unit_id)! - unitOrder.get(b.unit_id)!) || a.sort_order - b.sort_order)
    .map((l) => {
      const c = content?.find((x) => x.lesson_id === l.id);
      return {
        id: l.id, title: l.title, unitId: l.unit_id,
        unitTitle: units.find((u) => u.id === l.unit_id)?.title ?? "",
        explanation: c?.explanation ?? "", summary: c?.summary ?? "",
        keyPoints: Array.isArray(c?.key_points) ? (c!.key_points as unknown[]).map(String) : [],
        flashcards: (cards ?? []).filter((f) => f.lesson_id === l.id).map((f) => ({ front: f.front, back: f.back })),
      };
    });
}

/** Plain-text source for one lesson, used to ground exam questions. */
export function lessonSource(l: SubjectLesson): string {
  return [
    `### الوحدة: ${l.unitTitle} — الدرس: ${l.title}`,
    strip(l.explanation.replace(/<\/(p|h\d|li|div)>/gi, "\n")),
    l.summary && `الملخص: ${strip(l.summary)}`,
    l.keyPoints.length ? `نقاط مهمة:\n- ${l.keyPoints.join("\n- ")}` : "",
    l.flashcards.length ? `بطاقات:\n${l.flashcards.map((f) => `- ${f.front}: ${f.back}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** Automatic question count: roughly one good question per 450 characters, 3–20 per chunk. */
export function autoQuestionCount(chars: number) {
  return Math.min(20, Math.max(3, Math.round(chars / 450)));
}

export const plainText = strip;
