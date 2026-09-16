// Small formatters for the dashboard's mono labels.

export const formatCoord = (lat: number, lon: number): string => {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}  ${Math.abs(lon).toFixed(2)}° ${ew}`;
};

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

export const formatKm = (km: number): string => `${Math.round(km).toLocaleString("en-GB")} km`;

export interface TravelCounts {
  citiesVisited: number;
  countriesVisited: number;
  tripsCompleted: number;
  distanceKm: number;
}

export const hasTravelHistory = (s: TravelCounts): boolean =>
  s.citiesVisited > 0 || s.countriesVisited > 0 || s.tripsCompleted > 0 || s.distanceKm > 0;

/** "4 cities · 2 countries · 3 trips · 1,240 km", zeros left out. */
export const travelSummaryLine = (s: TravelCounts): string => {
  const parts: string[] = [];
  if (s.citiesVisited > 0) parts.push(plural(s.citiesVisited, "city", "cities"));
  if (s.countriesVisited > 0) parts.push(plural(s.countriesVisited, "country", "countries"));
  if (s.tripsCompleted > 0) parts.push(plural(s.tripsCompleted, "trip"));
  if (s.distanceKm > 0) parts.push(formatKm(s.distanceKm));
  return parts.join(" · ");
};
