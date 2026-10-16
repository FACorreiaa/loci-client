import type { VisitedPlace } from "~/lib/api/travel-history";

export interface CityVisits {
  city: string;
  places: VisitedPlace[];
}

const OTHER = "Other places";
const time = (v: VisitedPlace) => v.visitedAt?.getTime() ?? 0;

/**
 * Places the traveller has been, grouped by city. Cities are ordered by their
 * most recent visit and places within a city newest first, so the trip they
 * just took is at the top.
 */
export function groupVisitsByCity(visits: VisitedPlace[]): CityVisits[] {
  const byCity = new Map<string, VisitedPlace[]>();
  for (const v of [...visits].sort((a, b) => time(b) - time(a))) {
    const city = v.cityName.trim() || OTHER;
    const list = byCity.get(city);
    if (list) list.push(v);
    else byCity.set(city, [v]);
  }
  return [...byCity].map(([city, places]) => ({ city, places }));
}
