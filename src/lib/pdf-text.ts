/** Extracts plain text from an uploaded PDF or TXT file, in the browser. */
export async function extractText(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return await file.text();
  }

  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (text) parts.push(`--- صفحة ${i} ---\n${text}`);
  }
  return parts.join("\n\n");
}
