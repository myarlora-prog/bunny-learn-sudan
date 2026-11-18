import type { DraftUnit } from "@/lib/admin-ai.functions";

/** Split book text into ordered parts on paragraph/page boundaries. */
export function splitBook(text: string, size = 12000): string[] {
  const paras = text.split(/\n{2,}/);
  const parts: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > size) { parts.push(cur); cur = ""; }
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) parts.push(p.slice(i, i + size));
      continue;
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Append a part's units in order; a unit continuing the previous one is merged into it. */
export function mergeUnits(prev: DraftUnit[], next: DraftUnit[]): DraftUnit[] {
  const out = prev.map((u) => ({ ...u, lessons: [...u.lessons] }));
  for (const u of next) {
    const last = out[out.length - 1];
    if (last && last.title.trim() === (u.title ?? "").trim()) last.lessons.push(...(u.lessons ?? []));
    else out.push({ ...u, lessons: [...(u.lessons ?? [])] });
  }
  return out;
}

export const countLessons = (units: DraftUnit[]) => units.reduce((n, u) => n + u.lessons.length, 0);
