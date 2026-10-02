// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import TripPlanPanel, { type TripPlanPanelProps } from "./TripPlanPanel";
import type { PlanApi } from "~/lib/api/trip-plan";
import type { Trip } from "~/lib/api/trips";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1",
  userId: "u",
  cityName: "Lisbon",
  title: "Lisbon",
  version: 3n,
  constraints: { pace: 0 as any, interests: [] },
  createdAt: "",
  updatedAt: "",
  days: [{ id: "d1", dayNumber: 1, stops: [], cityLat: 38.72, cityLon: -9.14 }],
  stays: [],
  flights: [],
  ...over,
});

const updated = (over = {}) =>
  create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n, ...over });

const fakeApi = (over: Partial<PlanApi> = {}): PlanApi => ({
  setDates: vi.fn(async () => updated({ startDate: "2026-11-12", endDate: "2026-11-15" })),
  setStay: vi.fn(async () => updated()),
  clearStay: vi.fn(async () => updated()),
  addFlight: vi.fn(async () => updated()),
  removeFlight: vi.fn(async () => updated()),
  buildLinks: vi.fn(async () => [
    { provider: "google_flights", label: "Google Flights", url: "https://g.example" },
  ]),
  hotelsNear: vi.fn(
    async () =>
      [
        {
          id: "h1",
          name: "Hotel Avenida",
          star_rating: 4,
          rating: 4.2,
          website: "https://a.example",
        },
        { id: "h2", name: "Palace", star_rating: 5, rating: 4.8 },
      ] as any,
  ),
  ...over,
});

const mount = (props: TripPlanPanelProps) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => createComponent(TripPlanPanel, props), host);
  return host;
};

const byId = (host: HTMLElement, id: string) =>
  host.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const type = (host: HTMLElement, id: string, value: string) => {
  const el = byId(host, id) as unknown as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("TripPlanPanel", () => {
  it("saves dates with the version it was shown", async () => {
    const api = fakeApi();
    const onUpdated = vi.fn();
    const host = mount({ trip: trip(), onUpdated, onConflict: vi.fn(), api });
    type(host, "plan-start", "2026-11-12");
    type(host, "plan-end", "2026-11-15");
    byId(host, "plan-save-dates").click();
    await flush();
    expect(api.setDates).toHaveBeenCalledWith("t1", "2026-11-12", "2026-11-15", 3n);
    expect(onUpdated.mock.calls[0][0].startDate).toBe("2026-11-12");
  });

  it("a stale version is a conflict, not an error", async () => {
    const api = fakeApi({
      setDates: vi.fn(async () => {
        throw new ConnectError("trip version conflict", Code.FailedPrecondition);
      }),
    });
    const onConflict = vi.fn();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict, api });
    type(host, "plan-start", "2026-11-12");
    type(host, "plan-end", "2026-11-15");
    byId(host, "plan-save-dates").click();
    await flush();
    expect(onConflict).toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("finds 4-star hotels near the city and saves the pick", async () => {
    const api = fakeApi();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    const stars = byId(host, "plan-stars-Lisbon") as unknown as HTMLSelectElement;
    stars.value = "4";
    stars.dispatchEvent(new Event("change", { bubbles: true }));
    byId(host, "plan-find-Lisbon").click();
    await flush();
    expect(api.hotelsNear).toHaveBeenCalledWith(38.72, -9.14);
    const picks = host.querySelectorAll('[data-testid="plan-hotel"]');
    expect(picks).toHaveLength(1);
    (picks[0] as HTMLElement).click();
    await flush();
    expect(api.setStay).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        cityName: "Lisbon",
        name: "Hotel Avenida",
        starRating: "4",
        poiId: "h1",
      }),
      3n,
    );
  });

  it("a city with no coordinates says so instead of searching", () => {
    const api = fakeApi();
    const host = mount({
      trip: trip({ days: [{ id: "d1", dayNumber: 1, stops: [] }] }),
      onUpdated: vi.fn(),
      onConflict: vi.fn(),
      api,
    });
    expect(byId(host, "plan-find-Lisbon")).toBeNull();
    expect(host.textContent).toContain("can't search hotels");
  });

  it("builds flight links, then saves the flight", async () => {
    const api = fakeApi();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    type(host, "plan-from", "New York");
    type(host, "plan-to", "Lisbon");
    type(host, "plan-depart", "2026-11-12");
    byId(host, "plan-links").click();
    await flush();
    expect(host.querySelector('a[href="https://g.example"]')).not.toBeNull();
    byId(host, "plan-save-flight").click();
    await flush();
    expect(api.addFlight).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        origin: { name: "New York" },
        destination: { name: "Lisbon" },
        departDate: "2026-11-12",
        passengers: 1,
      }),
      3n,
    );
  });
});

describe("TripPlanPanel hotel search feedback", () => {
  it("says when no hotel matches instead of showing nothing", async () => {
    const api = fakeApi();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    const stars = byId(host, "plan-stars-Lisbon") as unknown as HTMLSelectElement;
    stars.value = "3";
    stars.dispatchEvent(new Event("change", { bubbles: true }));
    byId(host, "plan-find-Lisbon").click();
    await flush();
    expect(host.querySelectorAll('[data-testid="plan-hotel"]')).toHaveLength(0);
    expect(byId(host, "plan-no-hotels-Lisbon")?.textContent).toContain("No 3★ hotels");
  });

  it("disables Find while it searches", async () => {
    let release!: (v: any) => void;
    const api = fakeApi({ hotelsNear: vi.fn(() => new Promise((r) => (release = r))) as any });
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    byId(host, "plan-find-Lisbon").click();
    await flush();
    expect((byId(host, "plan-find-Lisbon") as HTMLButtonElement).disabled).toBe(true);
    release([]);
    await flush();
    expect((byId(host, "plan-find-Lisbon") as HTMLButtonElement).disabled).toBe(false);
  });

  it("only https flight links are shown", () => {
    const host = mount({
      trip: trip({
        flights: [
          {
            id: "f1",
            origin: { name: "A" },
            destination: { name: "B" },
            departDate: "2026-11-12",
            passengers: 1,
            links: [
              { provider: "x", label: "Evil", url: "javascript:alert(1)" },
              { provider: "g", label: "Google Flights", url: "https://g.example" },
            ],
          },
        ],
      }),
      onUpdated: vi.fn(),
      onConflict: vi.fn(),
      api: fakeApi(),
    });
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://g.example"]);
  });
});
