import { describe, it, expect } from "vitest";
import { groupBlocks, partComplete, itemCount } from "./format-chunks";

describe("format chunks", () => {
  it("keeps every block in order", () => {
    const blocks = Array.from({ length: 50 }, (_, i) => `<p>فقرة ${i} ${"ن".repeat(200)}</p>`);
    const parts = groupBlocks(blocks, 1000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("\n")).toBe(blocks.join("\n"));
  });
  it("rejects a summary result that kept only the last of 10 points", () => {
    const src = Array.from({ length: 10 }, (_, i) => `- النقطة رقم ${i + 1} معلومة مهمة`).join("\n");
    expect(itemCount(src)).toBe(10);
    expect(partComplete(src, "<ul><li>النقطة رقم 10 معلومة مهمة</li></ul>", 0.85)).toBe(false);
    const full = `<ul>${Array.from({ length: 10 }, (_, i) => `<li>النقطة رقم ${i + 1} معلومة مهمة</li>`).join("")}</ul>`;
    expect(partComplete(src, full, 0.85)).toBe(true);
  });
});
