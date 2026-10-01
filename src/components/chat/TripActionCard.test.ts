// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ chatService: {} }));
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ActionProposalSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import TripActionCard, { type TripActionCardProps } from "./TripActionCard";
import type { TripActionApi } from "~/lib/api/trip-actions";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const hotels = create(ActionProposalSchema, {
  id: "p1",
  tripId: "t1",
  summary: "4★ hotels in Lisbon: pick one to stay at.",
  action: {
    kind: { case: "searchHotels", value: { cityName: "Lisbon", minStars: 4, maxStars: 4 } },
  },
  options: [
    {
      label: "Hotel Avenida · 4★",
      choice: { case: "stay", value: { cityName: "Lisbon", name: "Hotel Avenida" } },
    },
    {
      label: "Lisboa Plaza · 4★",
      choice: { case: "stay", value: { cityName: "Lisbon", name: "Lisboa Plaza" } },
    },
  ],
});
const dates = create(ActionProposalSchema, {
  id: "p2",
  tripId: "t1",
  summary: "Set the trip's dates to 12 Nov – 17 Nov 2026.",
  action: { kind: { case: "setDates", value: { startDate: "2026-11-12", endDate: "2026-11-17" } } },
});
const flight = create(ActionProposalSchema, {
  id: "p3",
  tripId: "t1",
  summary: "Flights New York → Lisbon",
  action: { kind: { case: "searchFlights", value: { departDate: "2026-11-12" } } },
  options: [
    {
      label: "Save this flight search",
      choice: {
        case: "flight",
        value: {
          origin: { name: "New York" },
          destination: { name: "Lisbon" },
          departDate: "2026-11-12",
          links: [
            { provider: "google_flights", label: "Google Flights", url: "https://g.example" },
          ],
        },
      },
    },
  ],
});

const api = (over: Partial<TripActionApi> = {}): TripActionApi => ({
  apply: vi.fn(async () => ({
    trip: create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n }),
  })),
  dismiss: vi.fn(async () => {}),
  ...over,
});

const mount = (props: TripActionCardProps) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => createComponent(TripActionCard, props), host);
  return host;
};
const byId = (host: HTMLElement, id: string) =>
  host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe("TripActionCard", () => {
  it("a pick-one card applies the chosen option with the trip's version", async () => {
    const a = api();
    const onApplied = vi.fn();
    const host = mount({
      proposal: hotels,
      baseVersion: 3n,
      onApplied,
      onDismissed: vi.fn(),
      api: a,
    });
    expect(host.textContent).toContain("4★ hotels in Lisbon");
    expect(byId(host, "trip-action-confirm")).toBeNull();
    (host.querySelectorAll('[data-testid="trip-action-option"]')[1] as HTMLElement).click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p1", 1, 3n);
    expect(onApplied.mock.calls[0][0].version).toBe(4n);
  });

  it("a write card confirms with no option", async () => {
    const a = api();
    const host = mount({
      proposal: dates,
      baseVersion: 3n,
      onApplied: vi.fn(),
      onDismissed: vi.fn(),
      api: a,
    });
    byId(host, "trip-action-confirm")!.click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p2", undefined, 3n);
  });

  it("a flight card shows its links and saves option 0", async () => {
    const a = api();
    const host = mount({
      proposal: flight,
      baseVersion: 3n,
      onApplied: vi.fn(),
      onDismissed: vi.fn(),
      api: a,
    });
    expect(host.querySelector('a[href="https://g.example"]')).not.toBeNull();
    byId(host, "trip-action-confirm")!.click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p3", 0, 3n);
  });

  it("a stale trip keeps the card and says why", async () => {
    const a = api({
      apply: vi.fn(async () => {
        throw new ConnectError("trip version conflict", Code.FailedPrecondition);
      }),
    });
    const onApplied = vi.fn();
    const host = mount({
      proposal: dates,
      baseVersion: 3n,
      onApplied,
      onDismissed: vi.fn(),
      api: a,
    });
    byId(host, "trip-action-confirm")!.click();
    await flush();
    expect(onApplied).not.toHaveBeenCalled();
    expect(byId(host, "trip-action-error")?.textContent).toContain("changed");
  });

  it("Not now dismisses on the server", async () => {
    const a = api();
    const onDismissed = vi.fn();
    const host = mount({
      proposal: dates,
      baseVersion: 3n,
      onApplied: vi.fn(),
      onDismissed,
      api: a,
    });
    byId(host, "trip-action-dismiss")!.click();
    await flush();
    expect(a.dismiss).toHaveBeenCalledWith("p2");
    expect(onDismissed).toHaveBeenCalled();
  });

  it("a pick-one card with no options has nothing to confirm", () => {
    const empty = create(ActionProposalSchema, {
      id: "p4",
      summary: "No 5★ hotels found near Lisbon.",
      action: {
        kind: { case: "searchHotels", value: { cityName: "Lisbon", minStars: 5, maxStars: 5 } },
      },
    });
    const host = mount({
      proposal: empty,
      baseVersion: 3n,
      onApplied: vi.fn(),
      onDismissed: vi.fn(),
      api: api(),
    });
    expect(byId(host, "trip-action-confirm")).toBeNull();
    expect(byId(host, "trip-action-option")).toBeNull();
    expect(byId(host, "trip-action-dismiss")).not.toBeNull();
  });
});
