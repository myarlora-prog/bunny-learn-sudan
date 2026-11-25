import { describe, expect, it } from "vitest";
import { activeTourSteps, type TourStep } from "./tour-steps";

const s = (key: string, order: number, enabled = true) => ({ step_key: key, sort_order: order, enabled }) as TourStep;

describe("activeTourSteps", () => {
  it("skips disabled steps", () => {
    expect(activeTourSteps([s("a", 1), s("b", 2, false), s("c", 3)]).map((x) => x.step_key)).toEqual(["a", "c"]);
  });
  it("follows saved order", () => {
    expect(activeTourSteps([s("a", 3), s("b", 1), s("c", 2)]).map((x) => x.step_key)).toEqual(["b", "c", "a"]);
  });

  it("shows unlock help immediately after the account step", () => {
    const steps = [s("choose_subject", 6), s("unlock_lessons", 5), s("profile", 4)];
    expect(activeTourSteps(steps).map((x) => x.step_key)).toEqual(["profile", "unlock_lessons", "choose_subject"]);
  });
});
