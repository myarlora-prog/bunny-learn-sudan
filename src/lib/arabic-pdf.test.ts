import { describe, expect, it } from "vitest";
import { assertReadableBookText, restorePdfTextItems, type PdfTextItem } from "./arabic-pdf";

const item = (str: string, x: number, y = 100, dir = "rtl"): PdfTextItem => ({
  str, dir, transform: [24, 0, 0, 24, x, y], width: str.trim() ? 10 : 8, height: 24,
});

describe("Arabic PDF extraction", () => {
  it("restores reversed presentation-form glyphs without breaking lam-alef", () => {
    const glyphs = [
      item("ﺎ", 295), item("ﻬ", 303), item("ﺻ", 314), item("ا", 334), item("ﻮ", 341), item("ﺧ", 353), item("و", 368),
      item(" ", 380, 100, "ltr"), item("دة", 386), item("ﺎ", 409), item("ﻤ", 417), item("ﻟ", 430), item("ا", 438),
      item(" ", 444, 100, "ltr"), item(":", 450, 100, "ltr"),
      item("ﻰ", 458), item("ﻟ", 478), item("و", 486), item("ﻷ", 497), item("ا", 511),
      item(" ", 518, 100, "ltr"), item("ة", 524), item("ﺪ", 536), item("ﺣ", 549), item("ﻮ", 564), item("ﻟ", 576), item("ا", 583),
    ];
    expect(restorePdfTextItems(glyphs)).toBe("الوحدة الأولى: المادة وخواصها");
  });

  it("attaches standalone tanween to its base and keeps the space outside the word", () => {
    const glyphs = [
      item("ا", 416.75), item("ً", 421.18), { ...item(" ", 420.08, 100, "ltr"), width: 0 },
      item("ﺰ", 420.08), item("ﻴ", 426.7), item("ﺣ", 430.32), item(" ", 437.74, 100, "ltr"),
    ];
    expect(restorePdfTextItems(glyphs)).toBe("حيزًا");
  });

  it("keeps an already logical Arabic line unchanged", () => {
    const text = "المادة كل شيء له كتلة ويشغل حيزًا.";
    expect(restorePdfTextItems([item(text, 100)])).toBe(text);
  });

  it("preserves separate lines and paragraph gaps", () => {
    const lines = [item("عنوان الدرس", 400, 200), item("الفقرة الأولى.", 400, 170), item("الفقرة الثانية.", 400, 100)];
    expect(restorePdfTextItems(lines)).toBe("عنوان الدرس\nالفقرة الأولى.\n\nالفقرة الثانية.");
  });

  it("rejects damaged and fragmented Arabic before AI", () => {
    expect(() => assertReadableBookText("نص عربي سليم يحتوي معلومات كافية لاختبار عملية القراءة قبل إرساله إلى المعالجة الذكية.")).not.toThrow();
    expect(() => assertReadableBookText("ا ل م ا دة ك ل ش ي ء ل ه ك ت ل ة و ي ش غ ل ح ي ز ا")).toThrow(/مجزأ|ترتيبه/);
    expect(() => assertReadableBookText("نص عربي \u0000 تالف لا يجب إرساله إلى الذكاء الاصطناعي لأن القراءة غير موثوقة.")).toThrow(/تالفة/);
  });
});
