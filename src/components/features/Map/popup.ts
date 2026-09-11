import { buildAppleMapsUrl, buildGoogleMapsUrl } from "~/lib/trip-kit";
import type { POI } from "./types";

export interface PopupOptions {
  isMobile: boolean;
  /** When supplied, the popup gains a "View details" button. */
  onActivate?: (poi: POI, index: number) => void;
}

/**
 * Builds popup DOM by hand rather than rendering a Solid component: the popup
 * lives inside Mapbox's own overlay container, outside the Solid tree.
 */
export const buildPopupContent = (poi: POI, index: number, opts: PopupOptions) => {
  const { isMobile, onActivate } = opts;

  const container = document.createElement("div");
  container.className = `map-popup p-3 ${isMobile ? "min-w-[180px] max-w-[250px]" : "min-w-[200px] max-w-[300px]"}`;

  const title = document.createElement("h3");
  title.className = `map-popup__title mb-1 ${isMobile ? "text-sm" : "text-base"}`;
  title.textContent = poi.name;
  container.appendChild(title);

  const category = document.createElement("p");
  category.className = `map-popup__meta mb-2 ${isMobile ? "text-xs" : "text-sm"}`;
  category.textContent = poi.category;
  container.appendChild(category);

  const meta = document.createElement("div");
  meta.className = `map-popup__meta flex items-center justify-between ${isMobile ? "text-xs" : "text-sm"}`;
  if (poi.rating != null) {
    const rating = document.createElement("span");
    rating.className = "font-coord";
    rating.textContent = `${poi.rating.toFixed(1)} rating`;
    meta.appendChild(rating);
  }
  if (poi.timeToSpend) {
    const time = document.createElement("span");
    time.textContent = poi.timeToSpend;
    meta.appendChild(time);
  }
  if (poi.budget) {
    const budget = document.createElement("span");
    budget.className = "font-medium";
    budget.textContent = poi.budget;
    meta.appendChild(budget);
  }
  container.appendChild(meta);

  if (poi.dogFriendly) {
    const badge = document.createElement("div");
    badge.className = `map-popup__badge ui-label mt-2 ${isMobile ? "text-xs" : "text-sm"} px-2 py-1 rounded-md inline-block`;
    badge.textContent = "Dog friendly";
    container.appendChild(badge);
  }

  // Coordinates arrive as numbers or strings depending on the source, and a
  // place the server could not resolve has none. No coordinates, no links —
  // the alternative is sending someone to a model's guess.
  const lat = Number(poi.latitude);
  const lng = Number(poi.longitude);
  const google = buildGoogleMapsUrl({ latitude: lat, longitude: lng, name: poi.name });
  const apple = buildAppleMapsUrl({ latitude: lat, longitude: lng, name: poi.name });

  if (google && apple) {
    const maps = document.createElement("div");
    maps.className = "map-popup__maps mt-2 flex gap-3 text-xs";
    for (const [label, href] of [
      ["Google Maps", google],
      ["Apple Maps", apple],
    ] as const) {
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      link.className = "map-popup__maplink underline underline-offset-2";
      // The map swallows clicks for selection; this one belongs to the link.
      link.addEventListener("click", (e) => e.stopPropagation());
      maps.appendChild(link);
    }
    container.appendChild(maps);
  }

  if (onActivate) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "map-popup__btn mt-3 w-full text-sm font-medium rounded-md px-3 py-1.5 transition-colors";
    btn.textContent = "View details";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onActivate(poi, index);
    });
    container.appendChild(btn);
  }

  return container;
};
