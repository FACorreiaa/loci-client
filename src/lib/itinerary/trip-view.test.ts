import { describe, expect, it } from "vitest";
import type { Trip, TripStop } from "@/lib/api/trips";
import type { ItineraryStop } from "./createItineraryStream";
import { findTripStop, mergeTripIntoStops, normalizeName, orderAfterNudge } from "./trip-view";

const stop = (over: Partial<TripStop> & { id: string; name: string }): TripStop => ({
  poiId: "",
  orderIndex: 0,
  notes: "",
  ...over,
});

const trip = (days: { id: string; dayNumber: number; cityName?: string; stops: TripStop[] }[]) =>
  ({ id: "t1", cityName: "Lisbon", version: 3n, days }) as unknown as Trip;

const card = (over: Partial<ItineraryStop> & { key: string; name: string }): ItineraryStop => ({
  enriched: true,
  ...over,
});

describe("mergeTripIntoStops", () => {
  it("draws the trip's order, not the generated one", () => {
    const view = mergeTripIntoStops(
      trip([
        {
          id: "d1",
          dayNumber: 1,
          stops: [
            stop({ id: "s2", name: "Miradouro", orderIndex: 1 }),
            stop({ id: "s1", name: "Castelo", orderIndex: 0 }),
          ],
        },
      ]),
      [card({ key: "k-mira", name: "Miradouro" }), card({ key: "k-cast", name: "Castelo" })],
    );
    expect(view.stops.map((s) => s.name)).toEqual(["Castelo", "Miradouro"]);
  });

  it("joins by place id before name, and keeps the generated card's key and details", () => {
    const view = mergeTripIntoStops(
      trip([
        {
          id: "d1",
          dayNumber: 1,
          stops: [stop({ id: "s1", name: "Renamed by me", poiId: "AAAA-1" })],
        },
      ]),
      [card({ key: "k1", name: "Castelo de São Jorge", placeId: "aaaa-1", blurb: "Hilltop fort" })],
    );
    expect(view.stops[0]).toMatchObject({
      key: "k1",
      name: "Renamed by me",
      blurb: "Hilltop fort",
      tripStopId: "s1",
      tripDayId: "d1",
      day: 0,
    });
  });

  it("falls back to the name, ignoring case and accents", () => {
    const view = mergeTripIntoStops(
      trip([{ id: "d1", dayNumber: 1, stops: [stop({ id: "s1", name: "castelo de sao jorge" })] }]),
      [card({ key: "k1", name: "Castelo de São Jorge", blurb: "Hilltop fort" })],
    );
    expect(view.stops[0].key).toBe("k1");
    expect(view.stops[0].blurb).toBe("Hilltop fort");
  });

  it("does not treat the nil uuid as a shared place id", () => {
    const nil = "00000000-0000-0000-0000-000000000000";
    const view = mergeTripIntoStops(
      trip([{ id: "d1", dayNumber: 1, stops: [stop({ id: "s1", name: "B", poiId: nil })] }]),
      [card({ key: "kA", name: "A", placeId: nil }), card({ key: "kB", name: "B", placeId: nil })],
    );
    expect(view.stops[0].key).toBe("kB");
  });

  it("gives each generated card to one stop only", () => {
    const view = mergeTripIntoStops(
      trip([
        {
          id: "d1",
          dayNumber: 1,
          stops: [
            stop({ id: "s1", name: "Café", orderIndex: 0 }),
            stop({ id: "s2", name: "Café", orderIndex: 1 }),
          ],
        },
      ]),
      [card({ key: "k1", name: "Café", blurb: "The first" })],
    );
    expect(view.stops.map((s) => s.key)).toEqual(["k1", "s2"]);
    expect(view.stops[1].blurb).toBeUndefined();
  });

  it("dresses a stop added later with what the server knows about its place", () => {
    const view = mergeTripIntoStops(
      trip([
        {
          id: "d1",
          dayNumber: 1,
          stops: [
            stop({
              id: "s9",
              name: "Pasted cafe",
              latitude: 38.71,
              longitude: -9.14,
              address: "Rua X 1",
              place: { category: "cafe", description: "Good coffee", rating: 4.4 },
              image: { url: "https://img/x.jpg", licence: "CC BY", attribution: "Ana" },
            }),
          ],
        },
      ]),
      [],
    );
    expect(view.stops[0]).toMatchObject({
      key: "s9",
      enriched: true,
      category: "cafe",
      blurb: "Good coffee",
      rating: 4.4,
      imageUrl: "https://img/x.jpg",
      latitude: 38.71,
      longitude: -9.14,
      address: "Rua X 1",
    });
    expect(view.stops[0].imageCredit).toMatchObject({ attribution: "Ana", licence: "CC BY" });
  });

  it("uses the stop's notes when nothing else describes it", () => {
    const view = mergeTripIntoStops(
      trip([
        { id: "d1", dayNumber: 1, stops: [stop({ id: "s1", name: "X", notes: "Book ahead" })] },
      ]),
      [],
    );
    expect(view.stops[0].blurb).toBe("Book ahead");
  });

  it("keeps an empty day, so there is somewhere to add to", () => {
    const view = mergeTripIntoStops(
      trip([
        { id: "d2", dayNumber: 2, stops: [] },
        { id: "d1", dayNumber: 1, stops: [stop({ id: "s1", name: "A" })] },
      ]),
      [],
    );
    expect(view.days.map((d) => [d.dayId, d.day, d.label])).toEqual([
      ["d1", 0, "Day 1"],
      ["d2", 1, "Day 2"],
    ]);
    expect(view.stops).toHaveLength(1);
  });

  it("numbers days by position and names the city on a multi-city trip", () => {
    const view = mergeTripIntoStops(
      trip([
        { id: "d1", dayNumber: 1, cityName: "Lisbon", stops: [stop({ id: "s1", name: "A" })] },
        { id: "d3", dayNumber: 3, cityName: "Porto", stops: [stop({ id: "s2", name: "B" })] },
      ]),
      [],
    );
    expect(view.days.map((d) => d.label)).toEqual(["Day 1 · Lisbon", "Day 2 · Porto"]);
    expect(view.stops.map((s) => [s.day, s.cityName])).toEqual([
      [0, "Lisbon"],
      [1, "Porto"],
    ]);
  });
});

describe("orderAfterNudge", () => {
  const t = trip([
    {
      id: "d1",
      dayNumber: 1,
      stops: [
        stop({ id: "a", name: "A", orderIndex: 0 }),
        stop({ id: "b", name: "B", orderIndex: 1 }),
        stop({ id: "c", name: "C", orderIndex: 2 }),
      ],
    },
  ]);

  it("swaps a stop with its neighbour", () => {
    expect(orderAfterNudge(t, "b", "up")).toEqual({ dayId: "d1", orderedStopIds: ["b", "a", "c"] });
    expect(orderAfterNudge(t, "b", "down")).toEqual({
      dayId: "d1",
      orderedStopIds: ["a", "c", "b"],
    });
  });

  it("has nowhere to go at either end, or for a stop it does not know", () => {
    expect(orderAfterNudge(t, "a", "up")).toBeNull();
    expect(orderAfterNudge(t, "c", "down")).toBeNull();
    expect(orderAfterNudge(t, "zzz", "up")).toBeNull();
  });
});

describe("helpers", () => {
  it("finds a stop and its day", () => {
    const t = trip([{ id: "d1", dayNumber: 1, stops: [stop({ id: "a", name: "A" })] }]);
    expect(findTripStop(t, "a")?.day.id).toBe("d1");
    expect(findTripStop(t, undefined)).toBeUndefined();
  });

  it("normalises names", () => {
    expect(normalizeName("  Pastéis de Belém! ")).toBe("pasteis de belem");
  });
});
