import { describe, expect, it, vi } from "vitest";
import { apply3DConfig, SOURCE_TERRAIN_DEM } from "./atmosphere";

/**
 * A map stub that behaves like Mapbox in the one way that matters here: a
 * source you add exists afterwards. Config properties are recorded so tests
 * can read back what the basemap was told.
 */
const stubMap = () => {
  const sources = new Set<string>();
  const config: Record<string, unknown> = {};
  return {
    addSource: vi.fn((id: string) => sources.add(id)),
    getSource: vi.fn((id: string) => (sources.has(id) ? { id } : undefined)),
    setTerrain: vi.fn(),
    setFog: vi.fn(),
    setConfigProperty: vi.fn((importId: string, key: string, value: unknown) => {
      config[`${importId}.${key}`] = value;
    }),
    config,
  } as any;
};

describe("apply3DConfig", () => {
  it("turns on 3D objects and the day preset in light mode", () => {
    const map = stubMap();
    apply3DConfig(map, false);
    expect(map.config["basemap.show3dObjects"]).toBe(true);
    expect(map.config["basemap.lightPreset"]).toBe("day");
  });

  it("uses the night preset in dark mode", () => {
    const map = stubMap();
    apply3DConfig(map, true);
    expect(map.config["basemap.lightPreset"]).toBe("night");
  });

  it("adds the DEM source and sets terrain when terrain is on", () => {
    const map = stubMap();
    apply3DConfig(map, false, { terrain: true });
    expect(map.addSource).toHaveBeenCalledWith(
      SOURCE_TERRAIN_DEM,
      expect.objectContaining({ type: "raster-dem", tileSize: 512 }),
    );
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: SOURCE_TERRAIN_DEM }),
    );
  });

  // It re-runs on every style.load and colour-mode change; adding a source
  // twice throws in Mapbox.
  it("adds the DEM source only once across repeated calls", () => {
    const map = stubMap();
    apply3DConfig(map, false, { terrain: true });
    apply3DConfig(map, true, { terrain: true });
    apply3DConfig(map, false, { terrain: true });
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.setTerrain).toHaveBeenCalledTimes(3);
  });

  it("leaves terrain alone when terrain is off (phones)", () => {
    const map = stubMap();
    apply3DConfig(map, false, { terrain: false });
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.setTerrain).not.toHaveBeenCalled();
  });

  // Classic styles throw on basemap config. That must not take terrain and
  // fog down with it, nor escape into the style.load handler.
  it("survives a throwing setConfigProperty", () => {
    const map = stubMap();
    map.setConfigProperty.mockImplementation(() => {
      throw new Error("Style has no import basemap");
    });
    expect(() => apply3DConfig(map, false, { terrain: true })).not.toThrow();
    expect(map.setTerrain).toHaveBeenCalled();
    expect(map.setFog).toHaveBeenCalled();
  });
});
