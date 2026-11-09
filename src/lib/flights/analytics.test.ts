import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("~/lib/analytics", () => ({ capture: (...a: unknown[]) => capture(...a) }));

import { trackFlightBuilt, trackFlightClicked, trackFlightOpened } from "./analytics";

beforeEach(() => capture.mockReset());

describe("flight analytics", () => {
  it("records a built search with codes only, never names", () => {
    trackFlightBuilt("hotels", {
      origin: { name: "Lisbon", iata: "LIS" },
      destination: { name: "Barcelona", iata: "BCN" },
      departDate: "2026-12-04",
      passengers: 2,
    });
    expect(capture).toHaveBeenCalledWith("flight_search_built", {
      source: "hotels",
      origin_iata: "LIS",
      destination_iata: "BCN",
      has_return: false,
      passengers: 2,
      cabin: "unspecified",
    });
    expect(JSON.stringify(capture.mock.calls[0][1])).not.toContain("Lisbon");
  });

  it("omits codes the search does not have", () => {
    trackFlightBuilt("trip", {
      origin: { name: "somewhere I typed" },
      destination: { name: "Porto" },
      departDate: "2026-12-04",
      returnDate: "2026-12-08",
      passengers: 1,
      cabin: "business",
    });
    const props = capture.mock.calls[0][1] as Record<string, unknown>;
    expect(props).not.toHaveProperty("origin_iata");
    expect(props).not.toHaveProperty("destination_iata");
    expect(props).toMatchObject({ has_return: true, cabin: "business" });
  });

  it("records opens and clicks", () => {
    trackFlightOpened("itinerary", "BCN");
    expect(capture).toHaveBeenLastCalledWith("flight_search_opened", {
      source: "itinerary",
      destination_iata: "BCN",
    });
    trackFlightOpened("activities");
    expect(capture).toHaveBeenLastCalledWith("flight_search_opened", { source: "activities" });

    trackFlightClicked(
      "chat",
      { provider: "skyscanner", label: "Skyscanner", url: "https://x" },
      {
        origin: { name: "L", iata: "LIS" },
        destination: { name: "P", iata: "OPO" },
        departDate: "2026-12-04",
        passengers: 1,
      },
    );
    expect(capture).toHaveBeenLastCalledWith("flight_link_clicked", {
      source: "chat",
      provider: "skyscanner",
      origin_iata: "LIS",
      destination_iata: "OPO",
    });
  });
});
