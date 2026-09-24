import { describe, expect, it } from "vitest";
import { MAPBOX_STYLES } from "~/lib/theme-colors";
import { DEFAULT_MAP_STYLE } from "./constants";
import { lightPresetFor, resolveMapStyle } from "./style";

const base = { style: DEFAULT_MAP_STYLE, followColorMode: true, isDark: false };

describe("resolveMapStyle", () => {
  // The bug this guards: followColorMode (default on) used to resolve every
  // map to classic light/dark, where buildings and light presets don't exist.
  it("keeps a 3D map on Standard in either colour mode", () => {
    expect(resolveMapStyle({ ...base, enable3D: true, isDark: false })).toBe(DEFAULT_MAP_STYLE);
    expect(resolveMapStyle({ ...base, enable3D: true, isDark: true })).toBe(DEFAULT_MAP_STYLE);
  });

  it("uses the classic style for the colour mode on a flat map", () => {
    expect(resolveMapStyle({ ...base, enable3D: false, isDark: false })).toBe(MAPBOX_STYLES.light);
    expect(resolveMapStyle({ ...base, enable3D: false, isDark: true })).toBe(MAPBOX_STYLES.dark);
  });

  it("uses the caller's style on a flat map that ignores colour mode", () => {
    expect(
      resolveMapStyle({ ...base, enable3D: false, followColorMode: false, style: "x://custom" }),
    ).toBe("x://custom");
  });
});

describe("lightPresetFor", () => {
  it("maps colour mode to Standard's preset", () => {
    expect(lightPresetFor(false)).toBe("day");
    expect(lightPresetFor(true)).toBe("night");
  });
});
