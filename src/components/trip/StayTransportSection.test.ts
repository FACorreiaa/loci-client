// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
const capture = vi.fn();
vi.mock("~/lib/analytics", () => ({ capture: (...a: unknown[]) => capture(...a) }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import {
  DayStartSchema,
  StayTransportSchema,
  StayTransportStatus,
  TransitMode,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import StayTransportSection from "./StayTransportSection";
import DayStartLine from "./DayStartLine";
import TripDaySection from "./TripDaySection";
import { resetHotelAnalytics } from "~/lib/hotels/analytics";

let dispose: (() => void) | undefined;
beforeEach(() => {
  capture.mockReset();
  resetHotelAnalytics();
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const transport = (over: Record<string, unknown> = {}) =>
  create(StayTransportSchema, {
    cityName: "Barcelona",
    stayName: "Verdi 254",
    status: StayTransportStatus.READY,
    stops: [
      { name: "Lesseps", mode: TransitMode.METRO, lines: ["L3"], walkMinutes: 9, routed: false },
      {
        name: "Trav de Dalt - La Granja",
        mode: TransitMode.BUS,
        lines: ["24", "V17"],
        walkMinutes: 3,
        routed: true,
      },
    ],
    airport: {
      airportName: "Barcelona El Prat",
      iata: "BCN",
      distanceKm: 14.2,
      googleDirectionsUrl: "https://maps.example/dir?destination=BCN",
    },
    attribution: "Map data © OpenStreetMap contributors.",
    ...over,
  });

const mount = (t = transport(), stayName?: string) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => createComponent(StayTransportSection, { transport: t, stayName, source: "trip" }),
    host,
  );
  return host;
};
const byId = (host: HTMLElement, id: string) =>
  host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const stops = (host: HTMLElement) =>
  [...host.querySelectorAll('[data-testid="stay-transport-stop"]')].map((li) =>
    [...li.children].map((c) => c.textContent),
  );

describe("StayTransportSection", () => {
  it("READY: the stops by mode, with lines and the walk, an estimate marked as one", () => {
    const host = mount();
    expect(host.querySelector("h2")?.textContent).toBe("Getting around from Verdi 254");
    expect(stops(host)).toEqual([
      ["Metro", "Lesseps · L3 · 9 min walk (estimate)"],
      ["Bus", "Trav de Dalt - La Granja · 24, V17 · 3 min walk"],
    ]);
    expect(byId(host, "stay-transport-note")).toBeNull();
    expect(host.textContent).toContain(
      "Map data © OpenStreetMap contributors. No live timetables.",
    );
  });

  it("the airport row links to directions in a new tab", () => {
    const host = mount();
    const row = byId(host, "stay-transport-airport")!;
    expect(row.textContent).toContain("BCN · 14 km");
    const a = row.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://maps.example/dir?destination=BCN");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(capture).toHaveBeenCalledWith("stay_directions_opened", {
      source: "trip",
      kind: "airport",
    });
  });

  it("an airport link that is not https is left as text", () => {
    const host = mount(
      transport({ airport: { iata: "BCN", distanceKm: 14, googleDirectionsUrl: "javascript:x" } }),
    );
    expect(byId(host, "stay-transport-airport")?.textContent).toContain("BCN · 14 km");
    expect(host.querySelector("a")).toBeNull();
  });

  it("a stop with no lines or name still reads", () => {
    const host = mount(
      transport({ stops: [{ name: "", mode: TransitMode.TRAM, walkMinutes: 4, routed: true }] }),
    );
    expect(stops(host)).toEqual([["Tram", "Unnamed stop · 4 min walk"]]);
  });

  it("READY with no stops says none are mapped, and keeps the airport", () => {
    const host = mount(transport({ stops: [] }));
    expect(byId(host, "stay-transport-note")?.textContent).toBe("No stops mapped nearby.");
    expect(byId(host, "stay-transport-airport")).not.toBeNull();
  });

  it("UNAVAILABLE shows no stops, says so, and keeps the airport", () => {
    const host = mount(transport({ status: StayTransportStatus.UNAVAILABLE }));
    expect(stops(host)).toEqual([]);
    expect(byId(host, "stay-transport-note")?.textContent).toBe("Nearby stops couldn't be loaded.");
    expect(byId(host, "stay-transport-airport")?.querySelector("a")).not.toBeNull();
  });

  it("NO_COORDINATES says there is nothing to measure from, and nothing else", () => {
    const host = mount(
      transport({ status: StayTransportStatus.NO_COORDINATES, stops: [], airport: undefined }),
    );
    expect(byId(host, "stay-transport-note")?.textContent).toBe(
      "We don't know where this stay is, so there's nothing to measure from.",
    );
    expect(byId(host, "stay-transport-airport")).toBeNull();
    expect(host.textContent).not.toContain("timetables");
  });

  it("names the stay as the trip does", () => {
    expect(mount(transport(), "Verdi 254 Apartments").querySelector("h2")?.textContent).toBe(
      "Getting around from Verdi 254 Apartments",
    );
  });

  it("counts a view with the status and counts only", () => {
    mount();
    expect(capture).toHaveBeenCalledWith("stay_transport_viewed", {
      source: "trip",
      status: "ready",
      stops: 2,
      day_starts: 0,
      has_airport: true,
    });
  });
});

describe("DayStartLine", () => {
  const start = (over: Record<string, unknown> = {}) =>
    create(DayStartSchema, {
      dayId: "d1",
      dayNumber: 1,
      firstStopName: "Park Güell",
      walkMinutes: 12,
      routed: true,
      suggestedMode: "walk",
      googleDirectionsUrl: "https://maps.example/dir?travelmode=transit",
      ...over,
    });
  const mountLine = (s = start()) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(() => createComponent(DayStartLine, { start: s, source: "trip" }), host);
    return host;
  };

  it("a walk: the minutes and a Directions link", () => {
    const host = mountLine();
    expect(host.textContent).toContain("From your hotel: 12 min walk");
    expect(host.textContent).not.toContain("estimate");
    const a = host.querySelector("a")!;
    expect(a.textContent).toContain("Directions");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(capture).toHaveBeenCalledWith("stay_directions_opened", {
      source: "trip",
      kind: "day",
      mode: "walk",
    });
  });

  it("an unrouted walk is marked an estimate", () => {
    expect(mountLine(start({ routed: false })).textContent).toContain(
      "Straight-line estimate, route not checked",
    );
  });

  it("too far to walk: public transport suggested, no minutes", () => {
    const host = mountLine(start({ suggestedMode: "transit", walkMinutes: 48, routed: false }));
    expect(host.textContent).toContain("From your hotel: public transport suggested");
    expect(host.textContent).not.toContain("48");
    expect(host.textContent).not.toContain("estimate");
    expect(host.querySelector("a")).not.toBeNull();
  });

  it("no link unless it is https", () => {
    expect(
      mountLine(start({ googleDirectionsUrl: "http://maps.example" })).querySelector("a"),
    ).toBeNull();
  });

  it("a trip day draws the line above its stops when it has one", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const day = { id: "d1", dayNumber: 1, stops: [] };
    dispose = render(
      () =>
        createComponent(TripDaySection, {
          day,
          tripCityName: "Barcelona",
          dotColor: "#000",
          dayStart: start(),
          children: undefined,
        }),
      host,
    );
    expect(byId(host, "day-start-line")?.textContent).toContain("From your hotel: 12 min walk");
    dispose();
    const bare = document.createElement("div");
    document.body.appendChild(bare);
    dispose = render(
      () =>
        createComponent(TripDaySection, {
          day,
          tripCityName: "Barcelona",
          dotColor: "#000",
          children: undefined,
        }),
      bare,
    );
    expect(byId(bare, "day-start-line")).toBeNull();
  });
});
