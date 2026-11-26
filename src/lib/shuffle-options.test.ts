import { describe, expect, it } from "vitest";
import { shuffleQuizOptions } from "./shuffle-options";

const qs = Array.from({ length: 40 }, (_, i) => ({ q: `s${i}`, options: [`right${i}`, "w1", "w2", "w3"], correct: 0 }));

describe("shuffleQuizOptions", () => {
  it("keeps the correct answer text linked to the correct index", () => {
    for (const q of shuffleQuizOptions(qs)) expect(q.options[q.correct]).toMatch(/^right/);
  });
  it("spreads correct answers evenly over all four positions", () => {
    const counts = [0, 0, 0, 0];
    for (const q of shuffleQuizOptions(qs)) counts[q.correct]!++;
    expect(counts).toEqual([10, 10, 10, 10]);
  });
  it("keeps the same four options", () => {
    const [q] = shuffleQuizOptions([qs[0]!]);
    expect([...q!.options].sort()).toEqual([...qs[0]!.options].sort());
  });
  it("changes order between attempts", () => {
    const a = shuffleQuizOptions(qs).map((q) => q.correct).join();
    const b = shuffleQuizOptions(qs).map((q) => q.correct).join();
    expect(a).not.toEqual(b);
  });
});
