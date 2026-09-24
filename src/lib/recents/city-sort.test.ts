import { describe, expect, it } from "vitest";
import { compareCities } from "./city-sort";

const city = (name: string, last: string, count: number) => ({
  city_name: name,
  last_activity: last,
  interactions: [],
  total_interactions: count,
});

const names = (xs: { city_name: string }[]) => xs.map((c) => c.city_name);

describe("compareCities", () => {
  const cities = [
    city("Porto", "2026-09-01T10:00:00Z", 3),
    city("Lisbon", "2026-09-01T10:00:00Z", 5),
    city("Braga", "2026-09-02T10:00:00Z", 3),
  ];

  it("breaks timestamp ties by name, identically on every run", () => {
    const sorted = names([...cities].sort(compareCities("recent", "desc")));
    expect(sorted).toEqual(["Braga", "Lisbon", "Porto"]);
    expect(names([...cities].reverse().sort(compareCities("recent", "desc")))).toEqual(sorted);
  });

  it("breaks count ties by name", () => {
    expect(names([...cities].sort(compareCities("activity_count", "desc")))).toEqual([
      "Lisbon",
      "Braga",
      "Porto",
    ]);
    expect(names([...cities].sort(compareCities("activity_count", "asc")))).toEqual([
      "Braga",
      "Porto",
      "Lisbon",
    ]);
  });

  it("returns 0 only for the same city", () => {
    expect(compareCities("recent", "desc")(cities[0], { ...cities[0] })).toBe(0);
  });

  it("sorts names alphabetically either way", () => {
    expect(names([...cities].sort(compareCities("alphabetical", "asc")))).toEqual([
      "Braga",
      "Lisbon",
      "Porto",
    ]);
  });
});
