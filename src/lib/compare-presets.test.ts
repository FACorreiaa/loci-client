import { describe, expect, it } from "vitest";
import { COMPARE_PRESETS, presetInput, type ComparePreset } from "./compare-presets";

// Wednesday 16 Sep 2026, noon local.
const now = new Date(2026, 8, 16, 12);

describe("COMPARE_PRESETS", () => {
  it("offers three presets, each with an origin and two candidates", () => {
    expect(COMPARE_PRESETS).toHaveLength(3);
    for (const p of COMPARE_PRESETS) {
      expect(p.origin.name).toBeTruthy();
      expect(p.candidates).toHaveLength(2);
    }
  });
});

describe("presetInput", () => {
  it("turns every preset into a request for the coming weekend", () => {
    for (const p of COMPARE_PRESETS) {
      const input = presetInput(p, now);
      expect(input).not.toBeNull();
      expect(input!.originCity).toBe(p.origin.name);
      expect(input!.candidates).toEqual(p.candidates.map((c) => c.name));
      expect(input!.startDate.getTime()).toBeGreaterThan(now.getTime());
      expect(input!.endDate.getTime()).toBeGreaterThan(input!.startDate.getTime());
    }
  });

  it("keeps a window the preset carries", () => {
    const window = { start: new Date(2026, 9, 4), end: new Date(2026, 9, 6, 23, 59) };
    const p: ComparePreset = { ...COMPARE_PRESETS[0], window };
    const input = presetInput(p, now)!;
    expect(input.startDate).toEqual(window.start);
    expect(input.endDate).toEqual(window.end);
  });

  it("is null when a preset cannot be compared as it stands", () => {
    const p: ComparePreset = { origin: { name: "Porto" }, candidates: [{ name: "Évora" }] };
    expect(presetInput(p, now)).toBeNull();
  });
});
