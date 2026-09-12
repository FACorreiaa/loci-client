/**
 * Builds the CompareWeekend request from what the form holds.
 *
 * Pure and separate from the form because of the coordinate rule below, which
 * is the kind of thing that is easy to get subtly wrong and impossible to test
 * through a component with the current setup.
 */
import type { CompareWeekendInput } from "./api/compare";
import type { DateWindow } from "./compare-defaults";

export interface SelectedCity {
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
}

/**
 * Returns the request, or null when it is not yet answerable.
 *
 * Coordinates are attached only when both are real numbers. The server treats a
 * non-zero latitude *or* longitude as "the client supplied a position" and
 * skips resolving the name, so sending half a pair would silently compare
 * against a point on the equator instead of the city someone typed.
 */
export function buildCompareInput(
  origin: SelectedCity | null,
  candidates: SelectedCity[],
  window: DateWindow,
): CompareWeekendInput | null {
  if (!origin || !origin.name.trim()) return null;
  if (candidates.length < 2) return null;
  if (!(window.end > window.start)) return null;

  const input: CompareWeekendInput = {
    originCity: origin.name.trim(),
    candidates: candidates.map((c) => c.name.trim()).filter(Boolean),
    startDate: window.start,
    endDate: window.end,
  };

  if (hasCoordinates(origin)) {
    input.originLat = origin.lat;
    input.originLon = origin.lon;
  }

  return input.candidates.length >= 2 ? input : null;
}

export function hasCoordinates(city: SelectedCity): boolean {
  return (
    typeof city.lat === "number" &&
    typeof city.lon === "number" &&
    Number.isFinite(city.lat) &&
    Number.isFinite(city.lon)
  );
}
