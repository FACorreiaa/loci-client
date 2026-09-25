/**
 * The SearchPOI request behind Contribute's "Something we're missing".
 *
 * `SearchPOIRequest.city_name` is validated `min_len: 1`, and this card used
 * to send `""` — so every search failed validation in production before it
 * reached the handler. The handler ignores the city on a hybrid (located)
 * search, so there the placeholder `"nearby"` is enough (iOS sends the same).
 * Without a location the search is semantic and the city is what scopes it,
 * so the scout has to type one.
 */
export interface MissingPlaceSearchFilters {
  cityName: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  searchType: "hybrid" | "semantic";
}

export const NEARBY_CITY = "nearby";

export function missingPlaceSearchFilters(
  here: { latitude: number; longitude: number } | null | undefined,
  typedCity: string,
): MissingPlaceSearchFilters | null {
  const city = typedCity.trim();
  if (here) {
    return {
      cityName: city || NEARBY_CITY,
      latitude: here.latitude,
      longitude: here.longitude,
      radiusKm: 25,
      searchType: "hybrid",
    };
  }
  if (!city) return null;
  return { cityName: city, searchType: "semantic" };
}
