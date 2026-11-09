// @vitest-environment happy-dom
//
// Walking legs sit between the two cards they connect, and nowhere else.

import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ItineraryStreamView from "./ItineraryStreamView";
import type { ItineraryStop } from "~/lib/itinerary/createItineraryStream";
import type { AccessibleRoute } from "~/lib/accessibility";

const stop = (name: string, day: number, extra: Partial<ItineraryStop> = {}): ItineraryStop => ({
  key: name,
  name,
  day,
  routeRef: name,
  enriched: true,
  ...extra,
});

let host: HTMLDivElement;
let dispose: () => void;

const mount = (stops: ItineraryStop[], routes?: AccessibleRoute[]) => {
  dispose = render(
    () => (
      <ItineraryStreamView
        phase="done"
        title="Lisbon"
        summary="Two days"
        stops={stops}
        enrichedCount={stops.length}
        accessibleRoutes={routes}
      />
    ),
    host,
  );
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  dispose?.();
  host.remove();
});

const route: AccessibleRoute = {
  day: 1,
  total_walk_minutes: 32,
  warnings: ["Day 1 is over your 30-minute daily limit."],
  legs: [
    {
      from_ref: "Castle",
      to_ref: "Cathedral",
      distance_m: 900,
      duration_min: 14,
      ascent_m: 40,
      routed: true,
      notes: [{ text: "Long steep descent", severity: "barrier", source: "routed" }],
      suggest_mode: "taxi",
    },
    {
      // The server's order; the client shows Tram 28 elsewhere in the day.
      from_ref: "Cathedral",
      to_ref: "Nowhere",
      distance_m: 300,
      duration_min: 5,
      ascent_m: 0,
      routed: false,
      notes: [],
    },
  ],
};

describe("ItineraryStreamView walking legs", () => {
  it("shows a day's walking and its warning under the day", () => {
    mount([stop("Castle", 0), stop("Cathedral", 0)], [route]);
    expect(host.textContent).toContain("About 32 min of walking between stops");
    expect(host.textContent).toContain("over your 30-minute daily limit");
  });

  it("draws the leg before the stop it arrives at", () => {
    mount([stop("Castle", 0), stop("Cathedral", 0)], [route]);
    const text = host.textContent!;
    const leg = text.indexOf("14 min walk · 900 m · 40 m climb");
    expect(leg).toBeGreaterThan(text.indexOf("Castle"));
    expect(leg).toBeLessThan(text.lastIndexOf("Cathedral"));
    expect(text).toContain("Consider a taxi");
    expect(text).toContain("Barrier: ");
    expect(text).toContain("Route check");
  });

  it("draws nothing between cards a leg does not connect", () => {
    mount([stop("Cathedral", 0), stop("Castle", 0)], [route]);
    expect(host.textContent).not.toContain("min walk");
  });

  it("is unchanged without routes", () => {
    mount([stop("Castle", 0), stop("Cathedral", 0)]);
    expect(host.textContent).not.toContain("walking between stops");
  });

  it("puts a stop's access notes on its card, barriers first, sourced", () => {
    mount([
      stop("Castle", 0, {
        accessibilityNotes: [
          { text: "Toilet on site", severity: "info", source: "ai_estimate" },
          {
            text: "Cobbled ramp",
            severity: "barrier",
            source: "open_data",
            source_licence: "ODbL",
          },
          { text: "Lift sometimes closed", severity: "caution", source: "verified_crowd" },
        ],
      }),
    ]);
    const text = host.textContent!;
    expect(text.indexOf("Cobbled ramp")).toBeLessThan(text.indexOf("Lift sometimes closed"));
    expect(text).not.toContain("Toilet on site");
    expect(text).toContain("+1 more note");
    expect(text).toContain("Open data · ODbL");
    expect(text).toContain("© OpenStreetMap contributors");
  });
});
