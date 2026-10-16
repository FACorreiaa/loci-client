import { describe, expect, it } from "vitest";
import { buildManualVisit } from "./travel-history";

describe("buildManualVisit", () => {
  it("carries the place and its city", () => {
    expect(
      buildManualVisit({
        id: "poi-1",
        name: "Miradouro",
        cityName: " Lisbon ",
        latitude: 38.71,
        longitude: -9.14,
      }),
    ).toMatchObject({
      poiId: "poi-1",
      poiName: "Miradouro",
      cityName: "Lisbon",
      latitude: 38.71,
      longitude: -9.14,
    });
  });

  it("refuses a place the server would reject: no city or no coordinates", () => {
    expect(
      buildManualVisit({ id: "p", name: "X", cityName: "", latitude: 1, longitude: 1 }),
    ).toBeUndefined();
    expect(
      buildManualVisit({ id: "p", name: "X", cityName: "Lisbon", latitude: 0, longitude: 0 }),
    ).toBeUndefined();
  });
});
