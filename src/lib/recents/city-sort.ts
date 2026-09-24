import type { CityInteractions } from "../api/types";

export type CitySortKey = "recent" | "alphabetical" | "activity_count";
export type SortOrder = "asc" | "desc";

type SortableCity = Pick<
  CityInteractions,
  "city_name" | "last_activity" | "interactions" | "total_interactions"
>;

const primary = (key: string, a: SortableCity, b: SortableCity): number => {
  switch (key) {
    case "alphabetical":
      return a.city_name.localeCompare(b.city_name, undefined, { sensitivity: "base" });
    case "activity_count":
      return (
        (a.total_interactions || a.interactions.length) -
        (b.total_interactions || b.interactions.length)
      );
    case "recent":
    default:
      return (Date.parse(a.last_activity) || 0) - (Date.parse(b.last_activity) || 0);
  }
};

/**
 * Comparator for the recents city grid.
 *
 * The old one never returned 0 and had no tiebreak (`a > b ? 1 : -1`), which
 * is not a consistent ordering: two cities with the same count or timestamp
 * swapped places between renders. Ties now fall back to the city name, and
 * the tiebreak is always A→Z whatever the chosen direction, so it reads as a
 * secondary sort rather than a flip.
 */
export function compareCities(key: string, order: string) {
  const dir = order === "asc" ? 1 : -1;
  return (a: SortableCity, b: SortableCity): number =>
    dir * primary(key, a, b) ||
    a.city_name.localeCompare(b.city_name, undefined, { sensitivity: "base" }) ||
    (a.city_name < b.city_name ? -1 : a.city_name > b.city_name ? 1 : 0);
}
