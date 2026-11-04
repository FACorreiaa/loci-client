// @vitest-environment happy-dom
//
// downloadCalendarForTrip reaches document and URL.createObjectURL, neither of
// which exists in the default node environment.

import { beforeEach, describe, expect, it } from "vitest";
import { downloadCalendarForTrip, type TripStop } from "./trip-kit";

const stops: TripStop[] = [
  { name: "Sé do Funchal", latitude: 32.648, longitude: -16.908, day: 0 },
  { name: "Mercado dos Lavradores", latitude: 32.65, longitude: -16.904, day: 0 },
];

/** The Blob the download was handed, so its body can be read back. */
let captured: Blob | null = null;

beforeEach(() => {
  captured = null;
  // happy-dom does not implement object URLs; define them rather than replace
  // the URL constructor, which other code in the module graph still needs.
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      captured = blob;
      return "blob:stub";
    },
    revokeObjectURL: () => {},
  });
});

const body = async (): Promise<string> => {
  expect(captured).not.toBeNull();
  return await captured!.text();
};

describe("downloadCalendarForTrip", () => {
  const fourDays: TripStop[] = [1, 2, 3, 4].map((day) => ({ name: `Stop ${day}`, day }));

  it("exports only the range, dated from its start, under its true day numbers", async () => {
    const result = downloadCalendarForTrip(
      { title: "Funchal", cityName: "Funchal", stops: fourDays, isPro: true, stopsPerDay: 4 },
      { startDate: new Date(2026, 10, 14, 9, 0, 0) },
      { from: 2, to: 3 },
    );
    expect(result.ok).toBe(true);
    const ics = await body();
    expect(ics).toContain("Stop 3");
    expect(ics).toContain("Stop 4");
    expect(ics).not.toContain("Stop 1");
    expect(ics).not.toContain("Stop 2");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261114");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261115");
    expect(ics).toContain("Day 3");
    expect(ics).toContain("Day 4");
    expect(ics).not.toContain("Day 1");
  });

  // Chunked stops have no day of their own until grouped, so a range cut from
  // the flat list would re-chunk from its first stop and export the wrong ones.
  it("cuts chunked stops by their days", async () => {
    const chunked: TripStop[] = ["A", "B", "C", "D", "E"].map((name) => ({ name }));
    downloadCalendarForTrip(
      { title: "Funchal", cityName: "Funchal", stops: chunked, isPro: true, stopsPerDay: 2 },
      { startDate: new Date(2026, 10, 14, 9, 0, 0) },
      { from: 1, to: 1 },
    );
    const ics = await body();
    expect(ics).toContain("SUMMARY:C");
    expect(ics).toContain("SUMMARY:D");
    expect(ics).not.toContain("SUMMARY:A");
    expect(ics).not.toContain("SUMMARY:E");
    expect(ics).toContain("Day 2");
  });

  // The bug as reported: a trip on 8-11 October was written into the calendar
  // starting tomorrow, because this function had no parameter to receive a
  // date and silently dropped the one buildItineraryIcs already accepted.
  it("forwards a start date through to the calendar body", async () => {
    const result = downloadCalendarForTrip(
      { title: "Funchal", cityName: "Funchal", stops, isPro: true, stopsPerDay: 4 },
      { startDate: new Date(2026, 9, 8, 9, 0, 0) },
    );
    expect(result.ok).toBe(true);
    expect(await body()).toContain("DTSTART:20261008T");
  });

  it("still works, and still starts tomorrow, with no options", async () => {
    const result = downloadCalendarForTrip({
      title: "Funchal",
      cityName: "Funchal",
      stops,
      isPro: true,
      stopsPerDay: 4,
    });
    expect(result.ok).toBe(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const stamp =
      `${tomorrow.getUTCFullYear()}` +
      `${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
    expect(await body()).toContain(`DTSTART:${stamp}T`);
  });

  it("reports nothing to download when there are no stops", () => {
    expect(downloadCalendarForTrip({ title: "X", cityName: "X", stops: [], isPro: true })).toEqual({
      ok: false,
      locked: false,
    });
  });
});
