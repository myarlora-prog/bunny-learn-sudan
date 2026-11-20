import { assertReadableBookText, restorePdfTextItems, type PdfTextItem } from "@/lib/arabic-pdf";

/** Extracts plain text from an uploaded PDF, Word (.docx) or TXT file, in the browser. */
export async function extractText(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return await file.text();
  }

  if (/\.docx$/i.test(file.name) || file.type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }
  if (/\.doc$/i.test(file.name)) throw new Error("صيغة Word القديمة (.doc) غير مدعومة؛ احفظ الملف بصيغة .docx");

  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items.flatMap((item) => "str" in item ? [{
      str: item.str, dir: item.dir, transform: item.transform,
      width: item.width, height: item.height, hasEOL: item.hasEOL, fontName: item.fontName,
    }] : []);
    const text = restorePdfTextItems(items);
    if (text) parts.push(`--- صفحة ${i} ---\n${text}`);
  }
  const result = parts.join("\n\n");
  assertReadableBookText(result);
  return result;
}
