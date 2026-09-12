import { describe, it, expect } from "vitest";
import {
  defaultWeekend,
  nextWeekend,
  toDateInputValue,
  fromDateInputValue,
  formatWindow,
} from "./compare-defaults";

// Local noon, deliberately: midnight would put the "same day" assertions one
// timezone away from flaking.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("defaultWeekend", () => {
  it("finds the coming Saturday from midweek", () => {
    // Wednesday 16 September 2026.
    const { start, end } = defaultWeekend(at(2026, 9, 16));
    expect(start.getDay()).toBe(6);
    expect(toDateInputValue(start)).toBe("2026-09-19");
    expect(toDateInputValue(end)).toBe("2026-09-20");
  });

  it("skips the weekend already underway", () => {
    // On a Saturday the modulo is 0, and the `|| 7` is the only thing stopping
    // this returning a morning that is already half gone.
    const { start } = defaultWeekend(at(2026, 9, 19));
    expect(toDateInputValue(start)).toBe("2026-09-26");
  });

  it("does not offer yesterday when asked on a Sunday", () => {
    const { start } = defaultWeekend(at(2026, 9, 20));
    expect(toDateInputValue(start)).toBe("2026-09-26");
  });

  it("is always in the future", () => {
    for (let day = 1; day <= 28; day++) {
      const now = at(2026, 9, day);
      expect(defaultWeekend(now).start.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("spans exactly one night", () => {
    const { start, end } = defaultWeekend(at(2026, 9, 16));
    expect(end.getDay()).toBe(0);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("nextWeekend", () => {
  it("is a week after the coming one", () => {
    const now = at(2026, 9, 16);
    const a = defaultWeekend(now).start;
    const b = nextWeekend(now).start;
    expect(Math.round((b.getTime() - a.getTime()) / 86_400_000)).toBe(7);
  });
});

describe("date input round-trip", () => {
  it("reads back the value it wrote", () => {
    const original = at(2026, 9, 19);
    const parsed = fromDateInputValue(toDateInputValue(original));
    expect(parsed).not.toBeNull();
    expect(toDateInputValue(parsed!)).toBe("2026-09-19");
  });

  it("parses as local time, not UTC", () => {
    // `new Date("2026-09-19")` is UTC midnight, which is the 18th for anyone
    // west of Greenwich — a whole day wrong on the trip they asked for.
    const parsed = fromDateInputValue("2026-09-19");
    expect(parsed!.getDate()).toBe(19);
    expect(parsed!.getMonth()).toBe(8);
    expect(parsed!.getFullYear()).toBe(2026);
  });

  it("can land on the end of the day", () => {
    const parsed = fromDateInputValue("2026-09-20", true);
    expect(parsed!.getHours()).toBe(23);
    expect(parsed!.getMinutes()).toBe(59);
  });

  it("rejects anything that is not a date", () => {
    expect(fromDateInputValue("")).toBeNull();
    expect(fromDateInputValue("tomorrow")).toBeNull();
    expect(fromDateInputValue("19/09/2026")).toBeNull();
    expect(fromDateInputValue("2026-9-19")).toBeNull();
  });
});

describe("formatWindow", () => {
  it("describes the window without throwing", () => {
    const label = formatWindow(defaultWeekend(at(2026, 9, 16)));
    expect(label).toContain("–");
    expect(label.length).toBeGreaterThan(5);
  });
});
