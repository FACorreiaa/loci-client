import { describe, expect, it } from "vitest";
import { getPreloader } from "./preload";

describe("getPreloader", () => {
  it("resolves a fixed route by exact href", () => {
    expect(getPreloader("/discover")).toBeTypeOf("function");
  });

  // A pack lives at /packs/<slug>, so an exact key like "/packs/[slug]" would
  // never match and the Mapbox chunk would only start loading once the route
  // had already rendered.
  it("resolves a pack detail route by prefix", () => {
    expect(getPreloader("/packs/lisbon-jacarandas-3day")).toBeTypeOf("function");
  });

  it("does not preload a map for the catalog itself", () => {
    // The grid has no map; loading Mapbox there would be wasted bytes.
    expect(getPreloader("/packs")).toBeUndefined();
  });

  it("returns nothing for an unknown route", () => {
    expect(getPreloader("/nowhere")).toBeUndefined();
  });
});
