import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ComparedHotelSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { Trip } from "../api/trips";
import {
  CityNotOnTripError,
  cityOnTrip,
  hotelName,
  setStayFromReport,
  stayEligibility,
} from "./stay-from-report";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1",
  userId: "u",
  cityName: "Barcelona",
  title: "Barcelona",
  version: 3n,
  constraints: { pace: 0 as never, interests: [] },
  createdAt: "",
  updatedAt: "",
  days: [{ id: "d1", dayNumber: 1, stops: [] }],
  stays: [],
  flights: [],
  ...over,
});
const hotel = create(ComparedHotelSchema, {
  identified: true,
  stay: { cityName: "Barcelona", name: "Verdi 254", priceNote: "385 euros with breakfast" },
});
const saved = (version: bigint) =>
  create(TripDraftSchema, { id: "t1", title: "Barcelona", version });

describe("cityOnTrip", () => {
  it("finds the city as the trip's primary city, one of its cities, or a day's city", () => {
    expect(cityOnTrip(trip(), " barcelona ")).toBe("Barcelona");
    expect(
      cityOnTrip(
        trip({ cityName: "Lisbon", cities: [{ cityName: "Barcelona" }] as never }),
        "BARCELONA",
      ),
    ).toBe("Barcelona");
    expect(
      cityOnTrip(
        trip({
          cityName: "Madrid",
          days: [{ id: "d", dayNumber: 1, stops: [], cityName: "Barcelona" }],
        }),
        "barcelona",
      ),
    ).toBe("Barcelona");
  });

  it("is undefined for a city the trip doesn't go to, and for no city", () => {
    expect(cityOnTrip(trip(), "Lisbon")).toBeUndefined();
    expect(cityOnTrip(trip(), "")).toBeUndefined();
    // A prefix is not a match.
    expect(cityOnTrip(trip(), "Barcelon")).toBeUndefined();
  });
});

describe("stayEligibility", () => {
  it("a trip of the caller's own with the city can take the stay", () => {
    expect(stayEligibility(trip(), "barcelona")).toEqual({ ok: true, cityName: "Barcelona" });
  });
  it("a trip without the city says so", () => {
    expect(stayEligibility(trip({ cityName: "Lisbon" }), "Barcelona")).toEqual({
      ok: false,
      reason: "Barcelona isn't on this trip",
    });
  });
  it("someone else's trip cannot, even with the city", () => {
    const res = stayEligibility(trip({ owner: { id: "u2" } as never }), "Barcelona");
    expect(res.ok).toBe(false);
  });
});

describe("setStayFromReport", () => {
  it("saves against a freshly read version, under the trip's spelling of the city", async () => {
    const api = {
      fetchTrip: vi.fn(async () => trip({ cityName: "BARCELONA", version: 9n })),
      setStay: vi.fn(async () => saved(10n)),
    };
    const out = await setStayFromReport(api, "t1", hotel, "Barcelona");
    expect(api.setStay).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        cityName: "BARCELONA",
        name: "Verdi 254",
        priceNote: "385 euros with breakfast",
      }),
      9n,
    );
    expect(out.version).toBe(10n);
  });

  it("retries once on a version conflict, with the newer version", async () => {
    const fetchTrip = vi
      .fn()
      .mockResolvedValueOnce(trip({ version: 9n }))
      .mockResolvedValueOnce(trip({ version: 11n }));
    const setStay = vi
      .fn()
      .mockRejectedValueOnce(new ConnectError("trip version conflict", Code.FailedPrecondition))
      .mockResolvedValueOnce(saved(12n));
    const out = await setStayFromReport({ fetchTrip, setStay }, "t1", hotel, "Barcelona");
    expect(setStay.mock.calls.map((c) => c[2])).toEqual([9n, 11n]);
    expect(out.version).toBe(12n);
  });

  it("gives up after the second conflict", async () => {
    const conflict = new ConnectError("trip version conflict", Code.FailedPrecondition);
    const setStay = vi.fn(async () => {
      throw conflict;
    });
    await expect(
      setStayFromReport(
        { fetchTrip: vi.fn(async () => trip()), setStay },
        "t1",
        hotel,
        "Barcelona",
      ),
    ).rejects.toBe(conflict);
    expect(setStay).toHaveBeenCalledTimes(2);
  });

  it("does not retry any other failure", async () => {
    const setStay = vi.fn(async () => {
      throw new ConnectError("nope", Code.PermissionDenied);
    });
    await expect(
      setStayFromReport(
        { fetchTrip: vi.fn(async () => trip()), setStay },
        "t1",
        hotel,
        "Barcelona",
      ),
    ).rejects.toBeInstanceOf(ConnectError);
    expect(setStay).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the city has left the trip since the list was read", async () => {
    const setStay = vi.fn();
    await expect(
      setStayFromReport(
        { fetchTrip: vi.fn(async () => trip({ cityName: "Lisbon" })), setStay },
        "t1",
        hotel,
        "Barcelona",
      ),
    ).rejects.toBeInstanceOf(CityNotOnTripError);
    expect(setStay).not.toHaveBeenCalled();
  });
});

describe("hotelName", () => {
  it("is the stay's name, or a numbered stand-in", () => {
    expect(hotelName(hotel, 0)).toBe("Verdi 254");
    expect(hotelName(create(ComparedHotelSchema, {}), 1)).toBe("Hotel 2");
  });
});
