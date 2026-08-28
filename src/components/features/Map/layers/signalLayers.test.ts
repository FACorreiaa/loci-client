import { describe, expect, it, vi } from "vitest";
import { AlertKind } from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";
import type { LocalAlert } from "~/lib/api/localContext";
import { LAYER_SIGNAL_HALO, SOURCE_SIGNALS } from "../constants";
import { buildSignalData, ensureSignalLayers } from "./signalLayers";

/**
 * A map stub that behaves like Mapbox in the one way that matters here: things
 * you add exist afterwards.
 */
const stubMap = () => {
  const sources = new Set<string>();
  const layers = new Set<string>();
  const layoutProps: Record<string, string> = {};
  const sourceData: Record<string, unknown> = {};

  return {
    addSource: vi.fn((id: string, spec: { data?: unknown }) => {
      sources.add(id);
      sourceData[id] = spec.data;
    }),
    addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
    getSource: vi.fn((id: string) => (sources.has(id) ? { setData: vi.fn() } : undefined)),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    setLayoutProperty: vi.fn((id: string, prop: string, value: string) => {
      layoutProps[`${id}.${prop}`] = value;
    }),
    layoutProps,
  } as any;
};

const alert = (over: Partial<LocalAlert> = {}): LocalAlert => ({
  kind: AlertKind.HAZARD,
  title: "Wildfire",
  detail: "40 km away",
  severity: 0.5,
  source: "gdacs",
  lat: 38.8,
  lon: -9.3,
  ...over,
});

describe("ensureSignalLayers", () => {
  it("creates the source and both layers", () => {
    const map = stubMap();
    ensureSignalLayers(map);

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledWith(SOURCE_SIGNALS, expect.anything());
    expect(map.addLayer).toHaveBeenCalledTimes(2);
  });

  // Mapbox Standard can re-emit its style after `load` and silently drop custom
  // layers, so this runs on every style event. Adding twice throws in Mapbox.
  it("is idempotent — a second call adds nothing", () => {
    const map = stubMap();
    ensureSignalLayers(map);
    ensureSignalLayers(map);
    ensureSignalLayers(map);

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(2);
  });

  it("re-creates only what went missing", () => {
    const map = stubMap();
    ensureSignalLayers(map);
    map.addSource.mockClear();
    map.addLayer.mockClear();

    // Simulate the style dropping one layer but keeping the source.
    map.getLayer.mockImplementation((id: string) =>
      id === LAYER_SIGNAL_HALO ? undefined : { id },
    );
    ensureSignalLayers(map);

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: LAYER_SIGNAL_HALO }));
  });

  it("draws above the basemap", () => {
    const map = stubMap();
    ensureSignalLayers(map);
    for (const call of map.addLayer.mock.calls) {
      expect(call[0].slot).toBe("top");
    }
  });
});

describe("buildSignalData", () => {
  it("maps a located alert to a point feature", () => {
    const fc = buildSignalData([alert()]);
    expect(fc.features).toHaveLength(1);

    const f = fc.features[0];
    // GeoJSON is [lon, lat]. Reversing this is the classic silent bug: pins
    // land in the wrong hemisphere and simply look absent.
    expect(f.geometry).toMatchObject({ type: "Point", coordinates: [-9.3, 38.8] });
    expect(f.properties).toMatchObject({ title: "Wildfire", source: "gdacs", severity: 0.5 });
  });

  // Country-scoped alerts have no coordinates. Placing them at the city centre
  // would put a pin on a claim the data does not support.
  it("drops alerts that have no location", () => {
    const fc = buildSignalData([
      alert({ title: "Republic Day", lat: undefined, lon: undefined }),
      alert({ title: "Wildfire" }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.title).toBe("Wildfire");
  });

  it("drops half-located alerts rather than guessing", () => {
    const fc = buildSignalData([alert({ lat: 38.8, lon: undefined })]);
    expect(fc.features).toHaveLength(0);
  });

  // Zero means "unspecified" on the wire and reads as full weight; left raw it
  // would render an ungraded alert at the smallest possible size.
  it("normalises unspecified severity to full weight", () => {
    const fc = buildSignalData([alert({ severity: 0 })]);
    expect(fc.features[0].properties?.severity).toBe(1);
  });

  it("colours by severity, most severe distinct from least", () => {
    const minor = buildSignalData([alert({ severity: 0.25 })]).features[0].properties?.color;
    const major = buildSignalData([alert({ severity: 1 })]).features[0].properties?.color;
    expect(minor).not.toBe(major);
  });

  it("returns an empty collection for no alerts", () => {
    expect(buildSignalData([]).features).toHaveLength(0);
  });
});
