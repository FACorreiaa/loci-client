// A city's typical gastronomy: what people eat there and the well-known
// places to eat it. The same value arrives three ways — on itinerary and
// discovery answers (AiCityResponse.gastronomy), as the GASTRONOMY stream
// event of a "food in Madeira" search, and from GetCityGastronomy — and the
// server keys all three on the city alone, so asking again is a cache hit.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  DishCategory as ProtoDishCategory,
  GastronomyService,
  GetCityGastronomyRequestSchema,
  type CityGastronomy as ProtoCityGastronomy,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gastronomy/gastronomy_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import type { CityGastronomy, DishCategory, GastronomyDish, GastronomyPlace } from "./types";

const client = createClient(GastronomyService, transport);

const toCategory = (c: ProtoDishCategory): DishCategory => {
  switch (c) {
    case ProtoDishCategory.STREET_FOOD:
      return "street_food";
    case ProtoDishCategory.SNACK:
      return "snack";
    case ProtoDishCategory.DESSERT:
      return "dessert";
    case ProtoDishCategory.DRINK:
      return "drink";
    default:
      return "main";
  }
};

export const mapCityGastronomy = (g?: ProtoCityGastronomy): CityGastronomy | undefined => {
  if (!g) return undefined;
  return {
    city_name: g.cityName,
    country: g.country,
    overview: g.overview,
    culinary_traditions: [...g.culinaryTraditions],
    dining_tips: [...g.diningTips],
    dishes: g.dishes.map(
      (d): GastronomyDish => ({
        name: d.name,
        local_name: d.localName,
        description: d.description,
        category: toCategory(d.category),
        is_signature: d.isSignature,
        tags: [...d.tags],
        places: d.places.map(
          (p): GastronomyPlace => ({
            name: p.name,
            neighborhood: p.neighborhood,
            address: p.address,
            why_famous: p.whyFamous,
            price_range: p.priceRange,
            latitude: p.latitude,
            longitude: p.longitude,
            website: p.website || undefined,
          }),
        ),
      }),
    ),
  };
};

/** `{ gastronomy }` when the proto carries a renderable one, else `{}`. */
export const gastronomyField = (g?: ProtoCityGastronomy): { gastronomy?: CityGastronomy } => {
  const mapped = mapCityGastronomy(g);
  return hasGastronomy(mapped) ? { gastronomy: mapped } : {};
};

/** Whether there is anything worth rendering. */
export const hasGastronomy = (g: CityGastronomy | undefined | null): g is CityGastronomy =>
  !!g && g.dishes.length > 0;

export const DISH_CATEGORY_LABELS: Record<DishCategory, string> = {
  main: "Mains",
  street_food: "Street food",
  snack: "Snacks",
  dessert: "Desserts",
  drink: "Drinks",
};

const CATEGORY_ORDER: DishCategory[] = ["main", "street_food", "snack", "dessert", "drink"];

/** Categories present in the answer, in a fixed order, for filter chips. */
export const dishCategories = (g: CityGastronomy): DishCategory[] =>
  CATEGORY_ORDER.filter((c) => g.dishes.some((d) => d.category === c));

/** Tags present in the answer, most common first, for filter chips. */
export const dishTags = (g: CityGastronomy): string[] => {
  const counts = new Map<string, number>();
  for (const d of g.dishes) for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
};

export interface DishFilter {
  /** Empty means every category. */
  categories: DishCategory[];
  /** A dish must carry every selected tag. Empty means no tag filter. */
  tags: string[];
}

export const EMPTY_DISH_FILTER: DishFilter = { categories: [], tags: [] };

/**
 * Dishes matching the filter, signature dishes first. Filtering happens here
 * rather than on the server so every filter reads the one cached answer.
 */
export const filterDishes = (g: CityGastronomy, f: DishFilter): GastronomyDish[] =>
  g.dishes
    .filter((d) => f.categories.length === 0 || f.categories.includes(d.category))
    .filter((d) => f.tags.every((t) => d.tags.includes(t)))
    .sort((a, b) => Number(b.is_signature) - Number(a.is_signature));

/** A maps link for a place: exact coordinates when known, else a search. */
export const placeMapUrl = (p: GastronomyPlace, city: string): string =>
  p.latitude != null && p.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [p.name, p.address || p.neighborhood, city].filter(Boolean).join(", "),
      )}`;

export const gastronomyQueryKey = (city: string) =>
  ["gastronomy", city.trim().toLowerCase()] as const;

/**
 * The gastronomy of `city` from GetCityGastronomy. Disabled until a city is
 * chosen. Answers barely change, so a fetched city is kept for the session.
 */
export const useCityGastronomy = (
  city: () => string | undefined,
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => {
    const c = city()?.trim() ?? "";
    return {
      queryKey: gastronomyQueryKey(c),
      enabled: c.length > 0 && enabled(),
      staleTime: 60 * 60 * 1000,
      retry: false,
      queryFn: async (): Promise<CityGastronomy> => {
        const res = await client.getCityGastronomy(
          create(GetCityGastronomyRequestSchema, { city: { case: "cityName", value: c } }),
        );
        const g = mapCityGastronomy(res.gastronomy);
        if (!g) throw new Error("No gastronomy returned");
        return g;
      },
    };
  });
