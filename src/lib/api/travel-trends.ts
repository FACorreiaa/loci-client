// Period-over-period trends for the globe's stats rail.
//
// Pure, with a type-only import, so it tests without the transport.
import type { TravelSummary } from "./travel-history";

/**
 * Real period-over-period delta, or null when there is no prior period to
 * compare against.
 *
 * Returns null rather than 0 or 100% for a first period deliberately: an arrow
 * next to a number the user has no baseline for is decoration, and the stats
 * rail renders nothing instead.
 */
export const trendPercent = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
};

export interface SummaryTrends {
  cities: number | null;
  countries: number | null;
  pois: number | null;
}

type TrendInputs = Pick<
  TravelSummary,
  | "citiesVisited"
  | "countriesVisited"
  | "poisVisited"
  | "citiesVisitedPrev"
  | "countriesVisitedPrev"
  | "poisVisitedPrev"
  | "citiesVisitedThis"
  | "countriesVisitedThis"
  | "poisVisitedThis"
>;

/**
 * True when the server sent window counts (*_this_period). Those fields are
 * plain proto3 int32s with no presence, so "sent" can only mean non-zero.
 */
export const hasWindowCounts = (s: TrendInputs): boolean =>
  s.citiesVisitedThis > 0 || s.countriesVisitedThis > 0 || s.poisVisitedThis > 0;

/**
 * Trend per stat.
 *
 * Newer servers (api #101) send *_this_period and *_prev_period as counts in
 * two equal windows, and the trend is one against the other. Older servers
 * send only *_prev_period, as the all-time total when the current window
 * opened, so the trend there is the all-time total against it. Both shapes
 * are handled so the web works either side of the server deploy.
 *
 * Known gap: on a newer server, a user with nothing in the current window but
 * something in the previous one sends all-zero *_this_period and looks like an
 * older server, so they get the older (upward-only) arrow rather than -100%.
 */
export const summaryTrends = (s: TrendInputs): SummaryTrends => {
  if (hasWindowCounts(s)) {
    return {
      cities: trendPercent(s.citiesVisitedThis, s.citiesVisitedPrev),
      countries: trendPercent(s.countriesVisitedThis, s.countriesVisitedPrev),
      pois: trendPercent(s.poisVisitedThis, s.poisVisitedPrev),
    };
  }
  return {
    cities: trendPercent(s.citiesVisited, s.citiesVisitedPrev),
    countries: trendPercent(s.countriesVisited, s.countriesVisitedPrev),
    pois: trendPercent(s.poisVisited, s.poisVisitedPrev),
  };
};
