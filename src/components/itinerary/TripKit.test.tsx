// @vitest-environment happy-dom
//
// The range as a person uses it: the real component, the real inputs, and the
// .ics that comes out of Add to calendar.

import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TripKit from "./TripKit";
import type { TripStop } from "~/lib/trip-kit";

const fourDays: TripStop[] = [1, 2, 3, 4].flatMap((day) =>
  ["a", "b"].map((s) => ({
    name: `D${day}${s}`,
    day,
    latitude: 32.6 + day / 100,
    longitude: -16.9,
  })),
);

let host: HTMLDivElement;
let dispose: () => void;
let captured: Blob | null = null;

const mount = (stops: TripStop[] = fourDays) => {
  dispose = render(
    () => (
      <TripKit
        title="Funchal"
        cityName="Funchal"
        stops={stops}
        isPro={true}
        visible={true}
        startDate="2026-11-12"
      />
    ),
    host,
  );
};

const input = (id: string) => host.querySelector<HTMLInputElement>(`#${id}`);
const pick = (id: string, value: string, event = "change") => {
  const el = input(id)!;
  el.value = value;
  el.dispatchEvent(new Event(event, { bubbles: true }));
};
const routeDays = () =>
  [...host.querySelectorAll("ul li")].map((li) => li.querySelector("span")!.textContent!);
const addToCalendar = () =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Add to calendar"))!;

beforeEach(() => {
  captured = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      captured = blob;
      return "blob:stub";
    },
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  dispose();
  host.remove();
});

describe("TripKit date range", () => {
  it("starts on every day", () => {
    mount();
    expect(input("trip-range-from")!.value).toBe("2026-11-12");
    expect(input("trip-range-to")!.value).toBe("2026-11-15");
    expect(routeDays()).toHaveLength(4);
  });

  it("offers no range on a one-day plan", () => {
    mount(fourDays.filter((s) => s.day === 1));
    expect(input("trip-range-from")).toBeNull();
    expect(input("trip-range-to")).toBeNull();
    expect(routeDays()).toHaveLength(1);
  });

  it("gives one route per selected day, under its true number and date", () => {
    mount();
    pick("trip-range-from", "2026-11-14");
    expect(routeDays()).toHaveLength(2);
    expect(routeDays()[0]).toContain("Day 3");
    expect(routeDays()[0]).toContain("14");
    expect(routeDays()[1]).toContain("Day 4");
  });

  it("exports only the selected days to the calendar", async () => {
    mount();
    pick("trip-range-from", "2026-11-13");
    pick("trip-range-to", "2026-11-14");
    addToCalendar().click();
    const ics = await captured!.text();
    expect(ics).toContain("SUMMARY:D2a");
    expect(ics).toContain("SUMMARY:D3b");
    expect(ics).not.toContain("SUMMARY:D1a");
    expect(ics).not.toContain("SUMMARY:D4a");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261113");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261114");
    expect(ics).not.toContain("DTSTART;VALUE=DATE:20261115");
    expect(ics).toContain("Day 2");
    expect(ics).toContain("Day 3");
  });

  it("brings To along when From passes it", () => {
    mount();
    pick("trip-range-to", "2026-11-13");
    pick("trip-range-from", "2026-11-15");
    expect(input("trip-range-to")!.value).toBe("2026-11-15");
    expect(routeDays()).toHaveLength(1);
  });

  it("pulls typed dates back inside the trip", () => {
    mount();
    pick("trip-range-from", "2026-11-14");
    pick("trip-range-to", "2026-11-01");
    expect(input("trip-range-to")!.value).toBe("2026-11-14");
    pick("trip-range-to", "2026-12-25");
    expect(input("trip-range-to")!.value).toBe("2026-11-15");
  });

  it("puts a cleared field back rather than exporting a wrong range", () => {
    mount();
    pick("trip-range-from", "2026-11-14");
    pick("trip-range-from", "");
    expect(input("trip-range-from")!.value).toBe("2026-11-14");
    expect(routeDays()).toHaveLength(2);
  });

  it("keeps the same days when the start moves", () => {
    mount();
    pick("trip-range-from", "2026-11-13");
    pick("trip-range-to", "2026-11-14");
    pick("trip-start-date", "2026-12-01", "input");
    expect(input("trip-range-from")!.value).toBe("2026-12-02");
    expect(input("trip-range-to")!.value).toBe("2026-12-03");
    expect(routeDays()[0]).toContain("Day 2");
  });

  it("holds the calendar back while the start is cleared", () => {
    mount();
    pick("trip-start-date", "", "input");
    expect(addToCalendar().disabled).toBe(true);
    expect(input("trip-range-from")).toBeNull();
    expect(routeDays()).toHaveLength(4);
  });
});
