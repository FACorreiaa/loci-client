import { describe, expect, it } from "vitest";
import { buildInSeasonItems, marqueeDurationSeconds, needsMarquee } from "./in-season";
import type { SeasonalPick } from "./seasons";

const pick = (city: string, hook = "the harvest season", countryCode = "PT"): SeasonalPick => ({
  city,
  countryCode,
  months: [9],
  hook,
  emoji: "🍇",
});

const picks = [
  pick("Porto"),
  pick("Munich", "Oktoberfest", "DE"),
  pick("Ljubljana", "the golden hour", "SI"),
];

describe("buildInSeasonItems", () => {
  it("renders the curated picks alone when trending has not arrived", () => {
    const items = buildInSeasonItems(picks, undefined);
    expect(items.map((i) => i.city)).toEqual(["Porto", "Munich", "Ljubljana"]);
    expect(items.every((i) => i.planned === 0)).toBe(true);
    expect(items[0]).toMatchObject({
      id: "season:porto",
      countryCode: "PT",
      emoji: "🍇",
      hook: "the harvest season",
      prompt: "Plan 3 days in Porto for the harvest season",
    });
  });

  it("marks a pick as planned when a trending city matches, ignoring case and whitespace", () => {
    const items = buildInSeasonItems(picks, [
      { city_name: "  munich ", search_count: 3, emoji: "🍺" },
    ]);
    const munich = items.find((i) => i.city === "Munich");
    expect(munich?.planned).toBe(3);
    expect(munich?.emoji).toBe("🍇");
  });

  it("puts planned picks before unplanned ones, keeping table order otherwise", () => {
    const items = buildInSeasonItems(picks, [
      { city_name: "Ljubljana", search_count: 1, emoji: "x" },
    ]);
    expect(items.map((i) => i.city)).toEqual(["Ljubljana", "Porto", "Munich"]);
  });

  it("appends trending cities that are not in season after the picks", () => {
    const items = buildInSeasonItems(picks, [
      { city_name: "Funchal", search_count: 2, emoji: "🌺" },
    ]);
    const last = items[items.length - 1];
    expect(last).toMatchObject({
      id: "trending:funchal",
      city: "Funchal",
      countryCode: "",
      emoji: "🌺",
      hook: "planned this week",
      planned: 2,
      prompt: "Plan 3 days in Funchal",
    });
  });

  it("skips trending rows with no city name", () => {
    const items = buildInSeasonItems(picks, [{ city_name: "  ", search_count: 9, emoji: "x" }]);
    expect(items).toHaveLength(3);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => pick(`City${i}`));
    expect(buildInSeasonItems(many, undefined, 12)).toHaveLength(12);
    expect(buildInSeasonItems(many, undefined)).toHaveLength(12);
  });

  it("never repeats an id", () => {
    const items = buildInSeasonItems(picks, [
      { city_name: "Funchal", search_count: 2, emoji: "a" },
      { city_name: "funchal", search_count: 1, emoji: "b" },
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});

describe("marqueeDurationSeconds", () => {
  it("scales with the number of items but never drops below 30s", () => {
    expect(marqueeDurationSeconds(1)).toBe(30);
    expect(marqueeDurationSeconds(5)).toBe(30);
    expect(marqueeDurationSeconds(12)).toBe(72);
  });
});

describe("needsMarquee", () => {
  it("only moves when there are enough items to fill a row", () => {
    expect(needsMarquee(4)).toBe(false);
    expect(needsMarquee(5)).toBe(true);
  });
});
