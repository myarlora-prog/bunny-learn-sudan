/** Group ordered content blocks into parts of at most `size` characters without splitting or reordering blocks. */
export function groupBlocks(blocks: string[], size = 3500): string[] {
  const parts: string[] = [];
  for (const b of blocks.map((x) => x.trim()).filter(Boolean)) {
    const last = parts.length - 1;
    if (last >= 0 && parts[last]!.length + b.length + 1 <= size) parts[last] += `\n${b}`;
    else if (b.length <= size) parts.push(b);
    else for (let i = 0; i < b.length; i += size) parts.push(b.slice(i, i + size));
  }
  return parts;
}

const plain = (s: string) => s.replace(/<\/(p|h\d|li|div|tr|td|th)>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
export const wordCount = (s: string) => plain(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** Number of list items / lines in a source, used to verify no summary point was dropped. */
export function itemCount(s: string): number {
  const li = (s.match(/<li\b/gi) ?? []).length;
  if (li) return li;
  return s.split(/\n+/).filter((l) => /^\s*([-*•●▪]|\d+[.)-])\s*\S/.test(l)).length;
}
/** A formatted part is complete when it keeps (nearly) all words and every list item of its source. */
export function partComplete(source: string, html: string, minRatio: number): boolean {
  if (!html.trim()) return false;
  if (wordCount(html) / Math.max(1, wordCount(source)) < minRatio) return false;
  const items = itemCount(source);
  return !items || (html.match(/<li\b/gi) ?? []).length + (html.match(/<tr\b/gi) ?? []).length >= items || wordCount(html) >= wordCount(source);
}
