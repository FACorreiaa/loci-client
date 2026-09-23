import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  HereBriefSchema,
  HerePlaceSchema,
  NewsTickerItemSchema,
  WeatherDaySchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";
import {
  hasAnything,
  hereRefetchInterval,
  placeLabel,
  roundCoord2,
  settledBrief,
  toHereBrief,
  type HereBriefData,
} from "./hereBrief";

const item = (id: string) =>
  create(NewsTickerItemSchema, {
    id,
    title: `T ${id}`,
    url: `https://x/${id}`,
    source: "S",
    publishedAt: timestampFromDate(new Date("2026-09-23T10:00:00Z")),
    countryCode: "PT",
  });

describe("hereBrief", () => {
  it("rounds to 2 decimals for the query key", () => {
    expect(roundCoord2(41.694123)).toBe(41.69);
    expect(roundCoord2(-8.8351)).toBe(-8.84);
  });

  it("maps every part", () => {
    const d = toHereBrief(
      create(HereBriefSchema, {
        place: create(HerePlaceSchema, { locality: "Viana do Castelo", countryCode: "PT" }),
        weather: [create(WeatherDaySchema, { highC: 22, lowC: 14, condition: "Clear" })],
        local: [item("a")],
        disruption: [item("b")],
        whatsOn: [item("c")],
        stale: true,
      }),
    );
    expect(d.place.locality).toBe("Viana do Castelo");
    expect(d.weather[0].highC).toBe(22);
    expect([d.local[0].id, d.disruption[0].id, d.whatsOn[0].id]).toEqual(["a", "b", "c"]);
    expect(d.local[0].publishedAt).toBe("2026-09-23T10:00:00.000Z");
    expect(d.stale).toBe(true);
    expect(hasAnything(d)).toBe(true);
    expect(placeLabel(d)).toBe("Viana do Castelo");
  });

  it("news switched off still shows weather", () => {
    const d = toHereBrief(
      create(HereBriefSchema, { weather: [create(WeatherDaySchema, { condition: "Rain" })] }),
    );
    expect(hasAnything(d)).toBe(true);
    expect(d.local).toEqual([]);
  });

  it("empty response is nothing, and place falls back to region", () => {
    expect(hasAnything(toHereBrief(create(HereBriefSchema, {})))).toBe(false);
    expect(
      placeLabel(
        toHereBrief(
          create(HereBriefSchema, { place: create(HerePlaceSchema, { region: "Minho" }) }),
        ),
      ),
    ).toBe("Minho");
    expect(placeLabel(undefined)).toBe("");
  });
});

describe("settledBrief", () => {
  // Reading .data on a pending solid-query suspends to the app-wide Suspense
  // and blanks the whole dashboard, so a pending query must not be read.
  it("never touches data while pending", () => {
    const q = {
      isPending: true,
      get data(): HereBriefData | undefined {
        throw new Error("read .data while pending");
      },
    };
    expect(settledBrief(q)).toBeUndefined();
  });

  it("returns data once settled", () => {
    const d = toHereBrief(create(HereBriefSchema, {}));
    expect(settledBrief({ isPending: false, data: d })).toBe(d);
  });
});

describe("hereRefetchInterval", () => {
  it("polls while a new town's feeds are warming", () => {
    expect(hereRefetchInterval(toHereBrief(create(HereBriefSchema, { stale: true })))).toBe(30_000);
  });

  it("stops once headlines arrive or nothing is stale", () => {
    expect(
      hereRefetchInterval(
        toHereBrief(create(HereBriefSchema, { stale: true, local: [item("a")] })),
      ),
    ).toBe(false);
    expect(hereRefetchInterval(toHereBrief(create(HereBriefSchema, {})))).toBe(false);
    expect(hereRefetchInterval(undefined)).toBe(false);
  });
});
