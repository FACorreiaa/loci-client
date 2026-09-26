import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));

import { create } from "@bufbuild/protobuf";
import {
  CityGastronomySchema,
  DishCategory,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gastronomy/gastronomy_pb.js";
import {
  dishCategories,
  dishTags,
  EMPTY_DISH_FILTER,
  filterDishes,
  gastronomyField,
  gastronomyQueryKey,
  mapCityGastronomy,
  placeMapUrl,
} from "./gastronomy";
import type { CityGastronomy } from "./types";

const proto = create(CityGastronomySchema, {
  cityName: "Porto",
  country: "Portugal",
  overview: "Hearty northern cooking.",
  culinaryTraditions: ["Long Sunday lunches."],
  diningTips: ["Lunch starts at 12:30."],
  dishes: [
    {
      name: "Francesinha",
      category: DishCategory.MAIN,
      isSignature: true,
      tags: ["meat", "cheese"],
      places: [{ name: "Café Santiago", latitude: 41.1456, longitude: -8.611, priceRange: "€€" }],
    },
    {
      name: "Pastel de nata",
      localName: "Pastel de nata",
      category: DishCategory.DESSERT,
      tags: ["pastry", "vegetarian"],
      places: [{ name: "Manteigaria", neighborhood: "Bolhão", website: "https://example.com" }],
    },
    {
      name: "Bacalhau à Gomes de Sá",
      category: DishCategory.UNSPECIFIED,
      tags: ["fish"],
      places: [{ name: "Casa Aleixo" }],
    },
  ],
});

describe("mapCityGastronomy", () => {
  it("maps the proto to the snake_case client shape", () => {
    const g = mapCityGastronomy(proto)!;
    expect(g.city_name).toBe("Porto");
    expect(g.dishes).toHaveLength(3);
    expect(g.dishes[0]).toMatchObject({
      name: "Francesinha",
      category: "main",
      is_signature: true,
      tags: ["meat", "cheese"],
    });
    expect(g.dishes[0].places[0]).toMatchObject({
      latitude: 41.1456,
      longitude: -8.611,
      price_range: "€€",
    });
    expect(g.dishes[1].places[0].website).toBe("https://example.com");
    // An unspecified category is shown as a main, not dropped.
    expect(g.dishes[2].category).toBe("main");
  });

  it("is undefined for no gastronomy, and gastronomyField omits an empty one", () => {
    expect(mapCityGastronomy(undefined)).toBeUndefined();
    expect(gastronomyField(undefined)).toEqual({});
    expect(gastronomyField(create(CityGastronomySchema, { cityName: "X" }))).toEqual({});
    expect(gastronomyField(proto).gastronomy?.dishes).toHaveLength(3);
  });
});

describe("dish filters", () => {
  const g = mapCityGastronomy(proto) as CityGastronomy;

  it("lists present categories in a fixed order and tags by frequency", () => {
    expect(dishCategories(g)).toEqual(["main", "dessert"]);
    expect(dishTags(g)).toEqual(["cheese", "fish", "meat", "pastry", "vegetarian"]);
  });

  it("filters by category and requires every selected tag", () => {
    expect(filterDishes(g, EMPTY_DISH_FILTER).map((d) => d.name)[0]).toBe("Francesinha");
    expect(filterDishes(g, { categories: ["dessert"], tags: [] }).map((d) => d.name)).toEqual([
      "Pastel de nata",
    ]);
    expect(filterDishes(g, { categories: [], tags: ["vegetarian"] })).toHaveLength(1);
    expect(filterDishes(g, { categories: [], tags: ["meat", "pastry"] })).toHaveLength(0);
    expect(filterDishes(g, { categories: ["main"], tags: ["fish"] }).map((d) => d.name)).toEqual([
      "Bacalhau à Gomes de Sá",
    ]);
  });

  it("puts signature dishes first", () => {
    const names = filterDishes(g, { categories: ["main"], tags: [] }).map((d) => d.name);
    expect(names[0]).toBe("Francesinha");
  });
});

describe("placeMapUrl", () => {
  it("uses coordinates when known, else a name search in the city", () => {
    const g = mapCityGastronomy(proto) as CityGastronomy;
    expect(placeMapUrl(g.dishes[0].places[0], "Porto")).toContain("query=41.1456,-8.611");
    expect(placeMapUrl(g.dishes[1].places[0], "Porto")).toContain(
      encodeURIComponent("Manteigaria, Bolhão, Porto"),
    );
  });
});

describe("gastronomyQueryKey", () => {
  it("ignores case and surrounding space, like the server's city key", () => {
    expect(gastronomyQueryKey(" Madeira ")).toEqual(gastronomyQueryKey("madeira"));
  });
});
