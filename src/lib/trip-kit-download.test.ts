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
