import {
  BedDouble,
  Castle,
  Church,
  Eye,
  Landmark,
  MapPin,
  ShoppingBag,
  ShoppingCart,
  Trees,
  Utensils,
  Waves,
} from "lucide-solid";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

type IconComponent = Component<JSX.SvgSVGAttributes<SVGSVGElement>>;

/**
 * One icon per place category, shared by every surface that lists stops.
 *
 * Replaces two divergent emoji tables (StopCard, ItineraryResults). Emoji
 * render differently per OS, cannot take the theme's colour, and DESIGN.md
 * names them as an anti-pattern on badges. These are lucide marks, so they
 * inherit `currentColor` and sit on the same optical grid as the rest of the
 * UI.
 */
export function categoryIcon(category = ""): IconComponent {
  const c = category.toLowerCase();
  if (c.includes("museum") || c.includes("gallery")) return Landmark;
  if (c.includes("park") || c.includes("garden")) return Trees;
  if (c.includes("beach")) return Waves;
  if (c.includes("historic") || c.includes("castle") || c.includes("palace")) return Castle;
  if (c.includes("church") || c.includes("cathedral") || c.includes("temple")) return Church;
  if (c.includes("market")) return ShoppingCart;
  if (c.includes("hotel") || c.includes("hostel") || c.includes("ryokan")) return BedDouble;
  if (c.includes("restaurant") || c.includes("food") || c.includes("bar") || c.includes("cafe"))
    return Utensils;
  if (c.includes("view") || c.includes("lookout")) return Eye;
  if (c.includes("shop")) return ShoppingBag;
  return MapPin;
}

export function CategoryIcon(props: { category?: string; class?: string }) {
  return (
    <Dynamic
      component={categoryIcon(props.category)}
      class={props.class ?? "h-3.5 w-3.5"}
      aria-hidden="true"
    />
  );
}
