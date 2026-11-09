// @vitest-environment happy-dom
//
// Access is free on every plan: a traveller who needs step-free places must
// never meet a paywall to ask for them. The other filters stay Pro.
import { describe, expect, it } from "vitest";
import {
  ADVANCED_FILTERS,
  advancedFilterPromptSuffix,
  filterAvailable,
} from "./AdvancedFiltersBar";

describe("advanced filters", () => {
  it("offers Accessible on the free plan only", () => {
    const free = ADVANCED_FILTERS.filter((f) => filterAvailable(f, false)).map((f) => f.id);
    expect(free).toEqual(["accessible"]);
    expect(ADVANCED_FILTERS.every((f) => filterAvailable(f, true))).toBe(true);
  });

  it("folds only the filters this plan can use into the prompt", () => {
    expect(advancedFilterPromptSuffix(["accessible", "quiet"], false)).toBe(
      " Constraints: wheelchair accessible and step-free.",
    );
    expect(advancedFilterPromptSuffix(["accessible", "quiet"], true)).toBe(
      " Constraints: wheelchair accessible and step-free; low noise, calm spots.",
    );
    expect(advancedFilterPromptSuffix(["quiet"], false)).toBe("");
  });
});
