// @vitest-environment happy-dom
//
// The Find flights sheet as a traveller uses it: destination resolved and
// shown, origin picked from autocomplete, links built, clicks counted.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
const capture = vi.fn();
vi.mock("~/lib/analytics", () => ({ capture: (...a: unknown[]) => capture(...a) }));

import { render } from "solid-js/web";
import FindFlightsDialog from "./FindFlightsDialog";
import type { FlightPlaceOption, PlanApi } from "~/lib/api/trip-plan";

const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let dispose: (() => void) | undefined;

beforeEach(() => capture.mockReset());
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const lisbon: FlightPlaceOption = {
  iata: "LIS",
  name: "Lisbon Humberto Delgado Airport",
  city: "Lisbon",
  countryCode: "PT",
  kind: "airport",
};
const bcn: FlightPlaceOption = {
  iata: "BCN",
  name: "Josep Tarradellas Barcelona-El Prat Airport",
  city: "Barcelona",
  countryCode: "ES",
  kind: "airport",
};

const fakeApi = (over: Partial<PlanApi> = {}): PlanApi =>
  ({
    searchAirports: vi.fn(async () => [lisbon]),
    resolveDestination: vi.fn(async () => bcn),
    buildLinks: vi.fn(async () => [
      { provider: "google_flights", label: "Google Flights", url: "https://g.example/q" },
      { provider: "skyscanner", label: "Skyscanner", url: "https://s.example/x", sponsored: false },
    ]),
    ...over,
  }) as unknown as PlanApi;

const mount = (api: PlanApi) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <FindFlightsDialog
        open={true}
        onOpenChange={() => {}}
        source="hotels"
        city="Barcelona"
        countryCode="ES"
        api={api}
      />
    ),
    host,
  );
};

const q = <T extends Element = HTMLElement>(sel: string) =>
  document.body.querySelector(sel) as T | null;
const type = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("FindFlightsDialog", () => {
  it("resolves the destination when it opens and counts the open", async () => {
    const api = fakeApi();
    mount(api);
    await flush();
    expect(api.resolveDestination).toHaveBeenCalledWith("Barcelona", "ES", undefined, undefined);
    expect(q<HTMLInputElement>('[data-testid="flight-to"]')!.value).toBe("Barcelona (BCN)");
    expect(capture).toHaveBeenCalledWith("flight_search_opened", {
      source: "hotels",
      destination_iata: "BCN",
    });
  });

  it("keeps the city name when nothing resolves", async () => {
    mount(fakeApi({ resolveDestination: vi.fn(async () => undefined) }));
    await flush();
    expect(q<HTMLInputElement>('[data-testid="flight-to"]')!.value).toBe("Barcelona");
    expect(capture).toHaveBeenCalledWith("flight_search_opened", { source: "hotels" });
  });

  it("picks the origin from autocomplete, builds links and counts a click", async () => {
    const api = fakeApi();
    mount(api);
    await flush();

    const from = q<HTMLInputElement>('[data-testid="flight-from"]')!;
    expect(from.getAttribute("role")).toBe("combobox");
    type(from, "lis");
    await flush(250);
    expect(api.searchAirports).toHaveBeenCalledWith("lis");
    const option = q('[role="option"]')!;
    expect(option.textContent).toContain("Lisbon (LIS)");
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flush();
    expect(from.value).toBe("Lisbon (LIS)");

    type(q<HTMLInputElement>('[data-testid="flight-depart"]')!, "2026-12-04");
    q<HTMLButtonElement>('[data-testid="flight-search"]')!.click();
    await flush();

    expect(api.buildLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { name: "Lisbon", iata: "LIS" },
        destination: { name: "Barcelona", iata: "BCN" },
        departDate: "2026-12-04",
        passengers: 1,
      }),
    );
    expect(capture).toHaveBeenCalledWith(
      "flight_search_built",
      expect.objectContaining({ source: "hotels", origin_iata: "LIS", destination_iata: "BCN" }),
    );

    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>('a[data-testid="flight-link"]'),
    ];
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toContain("noopener");
      expect(a.rel).not.toContain("sponsored");
    }
    links[1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(capture).toHaveBeenLastCalledWith(
      "flight_link_clicked",
      expect.objectContaining({ source: "hotels", provider: "skyscanner", origin_iata: "LIS" }),
    );
  });

  it("marks sponsored links as such", async () => {
    mount(
      fakeApi({
        buildLinks: vi.fn(async () => [
          {
            provider: "skyscanner",
            label: "Skyscanner",
            url: "https://aff.example/r",
            sponsored: true,
          },
        ]),
      }),
    );
    await flush();
    type(q<HTMLInputElement>('[data-testid="flight-from"]')!, "Lisbon");
    type(q<HTMLInputElement>('[data-testid="flight-depart"]')!, "2026-12-04");
    q<HTMLButtonElement>('[data-testid="flight-search"]')!.click();
    await flush();
    expect(q<HTMLAnchorElement>('a[data-testid="flight-link"]')!.rel).toContain("sponsored");
  });

  it("offers Save to trip when the page passes onSave", async () => {
    const onSave = vi.fn(async () => true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <FindFlightsDialog
          open={true}
          onOpenChange={() => {}}
          source="trip"
          city="Barcelona"
          api={fakeApi()}
          onSave={onSave}
        />
      ),
      host,
    );
    await flush();
    type(q<HTMLInputElement>('[data-testid="flight-from"]')!, "Lisbon");
    type(q<HTMLInputElement>('[data-testid="flight-depart"]')!, "2026-12-04");
    q<HTMLButtonElement>('[data-testid="flight-search"]')!.click();
    await flush();
    q<HTMLButtonElement>('[data-testid="flight-save"]')!.click();
    await flush();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: { name: "Barcelona", iata: "BCN" },
        departDate: "2026-12-04",
      }),
    );
  });

  it("has no Save on a city page", async () => {
    mount(fakeApi());
    await flush();
    type(q<HTMLInputElement>('[data-testid="flight-from"]')!, "Lisbon");
    type(q<HTMLInputElement>('[data-testid="flight-depart"]')!, "2026-12-04");
    q<HTMLButtonElement>('[data-testid="flight-search"]')!.click();
    await flush();
    expect(q('[data-testid="flight-save"]')).toBeNull();
  });
});
