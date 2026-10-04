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
  | "hasPeriodCounts"
>;

/**
 * True when the server sent window counts (*_this_period). From proto v5.32.0
 * the server says so explicitly (has_period_counts), which is the only way to
 * tell "nothing this window" from "an older server". Without the flag the
 * counts are plain proto3 int32s with no presence, so "sent" can only mean
 * non-zero.
 */
export const hasWindowCounts = (s: TrendInputs): boolean =>
  s.hasPeriodCounts ||
  s.citiesVisitedThis > 0 ||
  s.countriesVisitedThis > 0 ||
  s.poisVisitedThis > 0;

/**
 * Window-against-window delta. Zeros are real here: nothing this window
 * against something last window is -100%, and nothing in either is flat (0).
 * Something this window against nothing last window still has no baseline.
 */
const windowTrend = (current: number, previous: number): number | null =>
  current === 0 && previous === 0 ? 0 : trendPercent(current, previous);

/**
 * Trend per stat.
 *
 * Servers that set has_period_counts send *_this_period and *_prev_period as
 * counts in two equal windows, and the trend is one against the other, used
 * exactly as sent. Older servers send only *_prev_period, as the all-time
 * total when the current window opened, so the trend there is the all-time
 * total against it. Servers between api #101 and has_period_counts send window
 * counts without the flag; they are detected by a non-zero *_this_period.
 */
export const summaryTrends = (s: TrendInputs): SummaryTrends => {
  if (s.hasPeriodCounts) {
    return {
      cities: windowTrend(s.citiesVisitedThis, s.citiesVisitedPrev),
      countries: windowTrend(s.countriesVisitedThis, s.countriesVisitedPrev),
      pois: windowTrend(s.poisVisitedThis, s.poisVisitedPrev),
    };
  }
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
