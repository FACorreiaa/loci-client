// @vitest-environment happy-dom
//
// The stamp, the day's sum and the map credit arrive from a lazy chunk. These
// pin that they do arrive, on the cards they belong to, and that a plan with
// no checks draws none of them.

import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ItineraryStreamView from "./ItineraryStreamView";
import type { ItineraryStop } from "~/lib/itinerary/createItineraryStream";

const stop = (name: string, extra: Partial<ItineraryStop> = {}): ItineraryStop => ({
  key: name,
  name,
  day: 0,
  enriched: true,
  ...extra,
});

let host: HTMLDivElement;
let dispose: () => void;

const mount = (stops: ItineraryStop[]) => {
  dispose = render(
    () => (
      <ItineraryStreamView
        phase="done"
        title="Lisbon"
        summary="One day"
        stops={stops}
        enrichedCount={stops.length}
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

describe("ItineraryStreamView stop checks", () => {
  it("draws each stop's stamp, the day's sum and the map credit", async () => {
    mount([
      stop("Museu Nacional do Azulejo", {
        dayDate: "2026-04-14T00:00:00.000Z",
        check: { status: "checked", hours: "opens_later", opensMinute: 600 },
      }),
      stop("Tasca do Chico", { check: { status: "not_found", hours: "not_listed" } }),
      stop("Miradouro da Graça"),
    ]);

    await vi.waitFor(() => expect(host.querySelectorAll(".check-stamp").length).toBe(2));

    const stamps = [...host.querySelectorAll(".check-stamp")];
    expect(stamps[0].getAttribute("data-tone")).toBe("attention");
    expect(stamps[0].textContent).toContain("Checked");
    expect(stamps[0].textContent).toContain("opens 10:00");
    expect(stamps[1].getAttribute("data-tone")).toBe("unknown");
    expect(stamps[1].textContent).toContain("Couldn't check");

    // Found on the map: one of the two that were looked up. The third stop
    // has not been looked up and is not counted either way.
    expect(host.querySelector(".check-verdict")?.textContent).toContain("1 of 2 checked");
    expect(host.querySelector(".check-verdict")?.textContent).toContain("1 needs a look");
    expect(host.textContent).toContain("OpenStreetMap contributors");
  });

  it("draws none of it for a plan nothing was checked on", async () => {
    mount([stop("Museu Nacional do Azulejo"), stop("Tasca do Chico")]);
    // Give a lazy chunk the chance to arrive, were one wrongly asked for.
    await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector(".check-stamp")).toBeNull();
    expect(host.querySelector(".check-verdict")).toBeNull();
    expect(host.textContent).not.toContain("OpenStreetMap");
  });
});
