import { describe, expect, it } from "vitest";
import { deriveWhyThis } from "./why-this";

describe("deriveWhyThis", () => {
  it("leads with what Loci knows about the traveller's taste", () => {
    expect(
      deriveWhyThis({
        category: "cafe",
        rating: 4.8,
        recommendation_rationale: "Matches your foodie profile.",
        taste_reasons: [" ", "Similar to Manteigaria, one of your picks"],
      }),
    ).toBe("Similar to Manteigaria, one of your picks");
  });

  it("prefers server rationale", () => {
    expect(
      deriveWhyThis({
        category: "museum",
        rating: 4.8,
        recommendation_rationale: "Matches your foodie profile.",
      }),
    ).toBe("Matches your foodie profile.");
  });

  it("falls back to high-rated category copy", () => {
    expect(deriveWhyThis({ category: "cafe", rating: 4.2 })).toBe(
      "Highly rated cafe that fits your search.",
    );
  });

  it("falls back to category matching prefs", () => {
    expect(deriveWhyThis({ category: "park", rating: 3.1 })).toBe(
      "A park matching your preferences.",
    );
  });

  it("returns undefined when empty", () => {
    expect(deriveWhyThis({})).toBeUndefined();
  });
});
