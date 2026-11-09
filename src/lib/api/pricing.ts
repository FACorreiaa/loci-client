// Live hotel prices — PricingService client. Prices come from a partner at
// request time and are never stored; the page refetches when the stay changes.
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import {
  GetHotelRatesRequestSchema,
  HotelRateStatus,
  PricingService,
  type HotelRate as WireHotelRate,
} from "@buf/loci_loci-proto.bufbuild_es/loci/pricing/v1/pricing_pb.js";
import { transport } from "../connect-transport";
import { minorToMajor } from "../results/price-filter";
import { resultKey } from "../results/outcome";
import type { POIDetailedInfo } from "./types";

const client = createClient(PricingService, transport);

/** The server's batch limit. */
export const MAX_HOTELS_PER_REQUEST = 30;

export type HotelPrice =
  | {
      status: "priced";
      /** Average per night, major units. */
      nightly: number;
      /** Whole stay, major units. */
      total: number;
      currency: string;
      bookingUrl: string;
      provider: string;
    }
  | { status: "sold_out"; provider: string }
  | { status: "unmatched" };

export interface Stay {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  adults: number;
  currency: string;
}

export interface HotelRatesResult {
  /** Keyed by resultKey(poi), the key the results page already uses. */
  prices: Map<string, HotelPrice>;
  nights: number;
}

/** Thrown when the partner is down, so the page can say so once. */
export class RatesUnavailableError extends Error {}

const toDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * The stay a dateless search is priced for: the coming Friday to Sunday
 * (next week's when today is already Friday or later), two adults.
 */
export function defaultStay(currency: string, today = new Date()): Stay {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const untilFriday = (5 - d.getDay() + 7) % 7 || 7;
  const checkin = new Date(d);
  checkin.setDate(d.getDate() + untilFriday);
  const checkout = new Date(checkin);
  checkout.setDate(checkin.getDate() + 2);
  return { checkin: toDate(checkin), checkout: toDate(checkout), adults: 2, currency };
}

export function nightsBetween(stay: Pick<Stay, "checkin" | "checkout">): number {
  const ms = Date.parse(`${stay.checkout}T00:00:00Z`) - Date.parse(`${stay.checkin}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function toHotelPrice(rate: WireHotelRate | undefined): HotelPrice {
  if (!rate) return { status: "unmatched" };
  switch (rate.status) {
    case HotelRateStatus.PRICED:
      return {
        status: "priced",
        nightly: minorToMajor(Number(rate.nightlyAmountMinor), rate.currency),
        total: minorToMajor(Number(rate.totalAmountMinor), rate.currency),
        currency: rate.currency,
        bookingUrl: rate.bookingUrl,
        provider: rate.provider,
      };
    case HotelRateStatus.SOLD_OUT:
      return { status: "sold_out", provider: rate.provider };
    default:
      return { status: "unmatched" };
  }
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** Prices hotels for a stay. Hotels beyond the batch limit come back unmatched. */
export async function fetchHotelRates(
  hotels: POIDetailedInfo[],
  stay: Stay,
  countryCode = "",
): Promise<HotelRatesResult> {
  const batch = hotels.slice(0, MAX_HOTELS_PER_REQUEST);
  const prices = new Map<string, HotelPrice>(
    hotels.map((h) => [resultKey(h), { status: "unmatched" }]),
  );
  if (batch.length === 0) return { prices, nights: nightsBetween(stay) };
  try {
    const resp = await client.getHotelRates(
      create(GetHotelRatesRequestSchema, {
        hotels: batch.map((h) => ({
          poiId: resultKey(h),
          name: h.name,
          latitude: num(h.latitude),
          longitude: num(h.longitude),
          city: h.city ?? "",
          countryCode,
        })),
        checkin: stay.checkin,
        checkout: stay.checkout,
        adults: stay.adults,
        currency: stay.currency,
      }),
    );
    for (const r of resp.rates) prices.set(r.poiId, toHotelPrice(r));
    return { prices, nights: resp.nights };
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.Unavailable) {
      throw new RatesUnavailableError(err.rawMessage);
    }
    throw err;
  }
}
