export type PdfTextItem = {
  str: string;
  dir?: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
  fontName?: string;
};

const ARABIC = /[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufeff]/;
const PRESENTATION = /[\ufb50-\ufdff\ufe70-\ufeff]/;
const space = (s: string) => /\s/.test(s);

function xOf(item: PdfTextItem) { return item.transform[4] ?? 0; }
function yOf(item: PdfTextItem) { return item.transform[5] ?? 0; }
function fontSize(item: PdfTextItem) { return Math.abs(item.transform[3] ?? item.height) || item.height || 10; }
const DIACRITICS = /^[\u064b-\u065f\u0670\u06d6-\u06ed]+$/;

/** Attach standalone marks to their base glyph and keep zero-width spaces outside the word. */
function prepareVisualItems(original: PdfTextItem[]): PdfTextItem[] {
  const items = original.map((item) => ({ ...item, transform: [...item.transform] }));
  const removed = new Set<number>();
  items.forEach((mark, index) => {
    if (!DIACRITICS.test(mark.str)) return;
    const candidates = items.map((item, i) => ({ item, i })).filter(({ item, i }) =>
      i !== index && !removed.has(i) && !space(item.str) && ARABIC.test(item.str) && !DIACRITICS.test(item.str),
    );
    const next = candidates.filter(({ i }) => i > index).sort((a, b) => Math.abs(xOf(a.item) - xOf(mark)) - Math.abs(xOf(b.item) - xOf(mark)))[0];
    const previous = candidates.filter(({ i }) => i < index).sort((a, b) => Math.abs(xOf(a.item) - xOf(mark)) - Math.abs(xOf(b.item) - xOf(mark)))[0];
    const base = next && Math.abs(xOf(next.item) - xOf(mark)) <= fontSize(mark) * 0.8 ? next : previous;
    if (!base) return;
    base.item.str += mark.str;
    removed.add(index);
  });
  return items.filter((item, index) => !removed.has(index) && !(space(item.str) && item.width < 0.01));
}

/** Rebuild lines from PDF coordinates. Some Arabic PDFs expose reversed presentation-form glyphs. */
export function restorePdfTextItems(input: PdfTextItem[]): string {
  const items = input.filter((item) => item.str && item.str.length > 0);
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items) {
    const y = yOf(item);
    const tolerance = Math.max(1.5, fontSize(item) * 0.18);
    const previous = lines[lines.length - 1];
    if (!previous || Math.abs(previous.y - y) > tolerance) lines.push({ y, items: [item] });
    else previous.items.push(item);
  }

  lines.sort((a, b) => b.y - a.y);
  const rendered = lines.map((line) => {
    const original = line.items;
    const joined = original.map((item) => item.str).join("");
    const rtlItems = original.filter((item) => item.dir === "rtl" && ARABIC.test(item.str));
    const forwardSteps = rtlItems.slice(1).filter((item, index) => xOf(item) >= xOf(rtlItems[index]!) - 1).length;
    const ascending = rtlItems.length > 1 && forwardSteps / (rtlItems.length - 1) >= 0.7;
    const fragmented = rtlItems.reduce((sum, item) => sum + item.str.trim().length, 0) / Math.max(1, rtlItems.length) <= 2.5;
    const visualArabic = rtlItems.length > 0 && ascending && fragmented && (PRESENTATION.test(joined) || rtlItems.length >= 4);
    const ordered = visualArabic ? prepareVisualItems(original).sort((a, b) => xOf(b) - xOf(a)) : original;

    let text = "";
    let previous: PdfTextItem | undefined;
    for (const item of ordered) {
      const value = visualArabic ? item.str.normalize("NFKC") : item.str;
      if (!visualArabic && previous && text && !space(text.slice(-1)) && !space(value.charAt(0))) {
        const gap = xOf(item) - (xOf(previous) + previous.width);
        if (gap > Math.max(1, fontSize(item) * 0.3)) text += " ";
      }
      text += value;
      previous = item;
    }
    return { y: line.y, height: Math.max(...original.map(fontSize)), text: text.replace(/[\t ]+/g, " ").trim() };
  }).filter((line) => line.text);

  let output = "";
  rendered.forEach((line, index) => {
    if (index === 0) { output = line.text; return; }
    const previous = rendered[index - 1]!;
    const verticalGap = previous.y - line.y;
    output += verticalGap > Math.max(previous.height, line.height) * 1.45 ? "\n\n" : "\n";
    output += line.text;
  });
  return output;
}

/** Stop before AI when extraction is clearly damaged instead of generating from corrupt text. */
export function assertReadableBookText(text: string): void {
  const value = text.trim();
  if (value.length < 50) throw new Error("لم نتمكن من قراءة نص كافٍ؛ قد يكون الملف صورًا ممسوحة. الصق النص يدويًا.");
  if (/[\u0000\ufffd]/.test(value)) throw new Error("النص المستخرج يحتوي رموزًا تالفة؛ لم تبدأ المعالجة الذكية.");
  const arabicChars = value.match(/[\u0600-\u06ff]/g)?.length ?? 0;
  const presentationChars = value.match(/[\ufb50-\ufdff\ufe70-\ufeff]/g)?.length ?? 0;
  if (presentationChars > 0 && presentationChars >= arabicChars * 0.05) {
    throw new Error("تعذر ترتيب الحروف العربية في PDF بصورة موثوقة؛ لم تبدأ المعالجة الذكية.");
  }
  const arabicWords = value.split(/\s+/).filter((word) => ARABIC.test(word));
  const isolated = arabicWords.filter((word) => /^[\u0621-\u064a]$/.test(word)).length;
  if (arabicWords.length >= 12 && isolated / arabicWords.length > 0.45) {
    throw new Error("النص العربي المستخرج مجزأ أو ترتيبه غير موثوق؛ لم تبدأ المعالجة الذكية.");
  }
}
