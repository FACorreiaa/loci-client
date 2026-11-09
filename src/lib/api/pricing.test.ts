import { create } from "@bufbuild/protobuf";
import {
  HotelRateSchema,
  HotelRateStatus,
} from "@buf/loci_loci-proto.bufbuild_es/loci/pricing/v1/pricing_pb.js";
import { describe, expect, it } from "vitest";
import { defaultStay, nightsBetween, toHotelPrice } from "./pricing";

describe("defaultStay", () => {
  it("prices the coming Friday to Sunday for two adults", () => {
    // Monday 2026-11-09.
    expect(defaultStay("EUR", new Date(2026, 10, 9))).toEqual({
      checkin: "2026-11-13",
      checkout: "2026-11-15",
      adults: 2,
      currency: "EUR",
    });
  });
  it("skips to next week on Friday and the weekend", () => {
    expect(defaultStay("EUR", new Date(2026, 10, 13)).checkin).toBe("2026-11-20");
    expect(defaultStay("EUR", new Date(2026, 10, 14)).checkin).toBe("2026-11-20");
    expect(defaultStay("EUR", new Date(2026, 10, 15)).checkin).toBe("2026-11-20");
  });
  it("crosses month ends", () => {
    expect(defaultStay("GBP", new Date(2026, 10, 30))).toMatchObject({
      checkin: "2026-12-04",
      checkout: "2026-12-06",
    });
  });
});

describe("nightsBetween", () => {
  it("counts nights across DST", () => {
    expect(nightsBetween({ checkin: "2026-10-24", checkout: "2026-10-26" })).toBe(2);
  });
});

describe("toHotelPrice", () => {
  it("converts minor units by currency", () => {
    const eur = toHotelPrice(
      create(HotelRateSchema, {
        poiId: "p",
        status: HotelRateStatus.PRICED,
        nightlyAmountMinor: 14250n,
        totalAmountMinor: 28500n,
        currency: "EUR",
        provider: "liteapi",
        bookingUrl: "https://book.example/x",
      }),
    );
    expect(eur).toEqual({
      status: "priced",
      nightly: 142.5,
      total: 285,
      currency: "EUR",
      bookingUrl: "https://book.example/x",
      provider: "liteapi",
    });
    const jpy = toHotelPrice(
      create(HotelRateSchema, {
        status: HotelRateStatus.PRICED,
        nightlyAmountMinor: 18000n,
        totalAmountMinor: 36000n,
        currency: "JPY",
      }),
    );
    expect(jpy).toMatchObject({ nightly: 18000, total: 36000 });
  });
  it("maps sold out and unmatched", () => {
    expect(
      toHotelPrice(
        create(HotelRateSchema, { status: HotelRateStatus.SOLD_OUT, provider: "liteapi" }),
      ),
    ).toEqual({
      status: "sold_out",
      provider: "liteapi",
    });
    expect(toHotelPrice(create(HotelRateSchema, { status: HotelRateStatus.UNMATCHED }))).toEqual({
      status: "unmatched",
    });
    expect(toHotelPrice(undefined)).toEqual({ status: "unmatched" });
  });
});
