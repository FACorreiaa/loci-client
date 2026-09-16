import { describe, expect, it } from "vitest";
import { formatCoord, formatKm, hasTravelHistory, plural, travelSummaryLine } from "./format";

describe("formatCoord", () => {
  it("labels hemispheres and rounds to two places", () => {
    expect(formatCoord(38.7223, -9.1393)).toBe("38.72° N  9.14° W");
    expect(formatCoord(-33.8688, 151.2093)).toBe("33.87° S  151.21° E");
    expect(formatCoord(0, 0)).toBe("0.00° N  0.00° E");
  });
});

describe("plural", () => {
  it("picks singular or plural, with an irregular override", () => {
    expect(plural(1, "stop")).toBe("1 stop");
    expect(plural(3, "stop")).toBe("3 stops");
    expect(plural(0, "stop")).toBe("0 stops");
    expect(plural(2, "city", "cities")).toBe("2 cities");
  });
});

describe("formatKm", () => {
  it("rounds and groups thousands", () => {
    expect(formatKm(0)).toBe("0 km");
    expect(formatKm(1240.4)).toBe("1,240 km");
  });
});

describe("travelSummaryLine", () => {
  it("joins every non-zero count with a middle dot", () => {
    expect(
      travelSummaryLine({
        citiesVisited: 4,
        countriesVisited: 2,
        tripsCompleted: 3,
        distanceKm: 1240,
      }),
    ).toBe("4 cities · 2 countries · 3 trips · 1,240 km");
  });

  it("uses singulars", () => {
    expect(
      travelSummaryLine({
        citiesVisited: 1,
        countriesVisited: 1,
        tripsCompleted: 1,
        distanceKm: 0,
      }),
    ).toBe("1 city · 1 country · 1 trip");
  });

  it("omits zeros and is empty when everything is zero", () => {
    expect(
      travelSummaryLine({
        citiesVisited: 2,
        countriesVisited: 0,
        tripsCompleted: 0,
        distanceKm: 0,
      }),
    ).toBe("2 cities");
    expect(
      travelSummaryLine({
        citiesVisited: 0,
        countriesVisited: 0,
        tripsCompleted: 0,
        distanceKm: 0,
      }),
    ).toBe("");
  });
});

describe("hasTravelHistory", () => {
  it("is false only when every count is zero", () => {
    expect(
      hasTravelHistory({ citiesVisited: 0, countriesVisited: 0, tripsCompleted: 0, distanceKm: 0 }),
    ).toBe(false);
    expect(
      hasTravelHistory({
        citiesVisited: 0,
        countriesVisited: 0,
        tripsCompleted: 0,
        distanceKm: 12,
      }),
    ).toBe(true);
  });
});
