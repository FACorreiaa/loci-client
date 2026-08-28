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
