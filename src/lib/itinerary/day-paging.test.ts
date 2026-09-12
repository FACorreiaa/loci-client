import { describe, expect, it } from "vitest";
import { INITIAL_DAYS, windowDays } from "./day-paging";

const days = (n: number) => Array.from({ length: n }, (_, i) => ({ day: i }));

describe("windowDays", () => {
  it("shows the opening days of a long trip and counts the rest", () => {
    const { visible, remaining } = windowDays(days(4), INITIAL_DAYS);
    expect(visible).toHaveLength(2);
    expect(remaining).toBe(2);
  });

  // A short trip must look untouched — no button, nothing to expand.
  it("leaves a trip no longer than the window alone", () => {
    expect(windowDays(days(2), INITIAL_DAYS)).toEqual({ visible: days(2), remaining: 0 });
    expect(windowDays(days(1), INITIAL_DAYS).remaining).toBe(0);
  });

  it("shows everything once expanded", () => {
    const { visible, remaining } = windowDays(days(4), 4);
    expect(visible).toHaveLength(4);
    expect(remaining).toBe(0);
  });

  it("never hides the whole trip", () => {
    expect(windowDays(days(3), 0).visible).toHaveLength(1);
  });

  it("handles an empty trip", () => {
    expect(windowDays([], INITIAL_DAYS)).toEqual({ visible: [], remaining: 0 });
  });
});
