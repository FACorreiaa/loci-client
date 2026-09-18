import { describe, expect, it } from "vitest";
import {
  DAYS,
  defaultOpeningHours,
  encodeOpeningHours,
  isValidOpeningHours,
  parseOpeningHours,
  type OpeningHours,
} from "./opening-hours";
import { CONTRIBUTABLE_FIELDS, PLACE_FACT_VOCABULARY, serializeTokens } from "./vocabulary";

describe("serializeTokens", () => {
  // The whole point of the vocabulary: two scouts who pick the same things in a
  // different order must produce the same string, or their claims never meet.
  it("is order independent", () => {
    expect(serializeTokens(["vegan", "gluten_free"])).toBe(
      serializeTokens(["gluten_free", "vegan"]),
    );
  });

  it("sorts and joins without spaces", () => {
    expect(serializeTokens(["vegan", "gluten_free"])).toBe("gluten_free,vegan");
  });

  it("de-duplicates and lowercases", () => {
    expect(serializeTokens(["Cosy", "cosy", " LOCAL "])).toBe("cosy,local");
  });

  it("drops empty entries", () => {
    expect(serializeTokens(["quiet", "", "  "])).toBe("quiet");
  });
});

describe("vocabulary", () => {
  it("covers every contributable field", () => {
    for (const field of CONTRIBUTABLE_FIELDS) {
      expect(PLACE_FACT_VOCABULARY[field]).toBeDefined();
    }
  });

  it("gives every choice field at least two options", () => {
    for (const field of CONTRIBUTABLE_FIELDS) {
      const vocabulary = PLACE_FACT_VOCABULARY[field];
      if (vocabulary.kind === "structured") continue;
      expect(vocabulary.options.length).toBeGreaterThan(1);
    }
  });

  it("uses wire-safe tokens", () => {
    for (const field of CONTRIBUTABLE_FIELDS) {
      for (const option of PLACE_FACT_VOCABULARY[field].options) {
        expect(option.token).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });
});

const week = (overrides: Partial<OpeningHours> = {}): OpeningHours => ({
  ...defaultOpeningHours(),
  ...overrides,
});

describe("encodeOpeningHours", () => {
  it("collapses consecutive days with identical hours", () => {
    expect(encodeOpeningHours(defaultOpeningHours())).toBe("mon-fri 09:00-17:00; sat-sun closed");
  });

  it("keeps a lone day ungrouped", () => {
    const hours = week({ sat: { closed: false, intervals: [{ start: "10:00", end: "14:00" }] } });
    expect(encodeOpeningHours(hours)).toBe("mon-fri 09:00-17:00; sat 10:00-14:00; sun closed");
  });

  it("sorts and merges overlapping intervals within a day", () => {
    const hours = week({
      sat: {
        closed: false,
        intervals: [
          { start: "19:00", end: "23:00" },
          { start: "12:00", end: "15:00" },
          { start: "14:00", end: "16:00" },
        ],
      },
    });
    expect(encodeOpeningHours(hours)).toBe(
      "mon-fri 09:00-17:00; sat 12:00-16:00,19:00-23:00; sun closed",
    );
  });

  // Two scouts entering the same week in a different order are the case this
  // whole module exists for.
  it("produces one string for one week however it was entered", () => {
    const first = week({
      sat: {
        closed: false,
        intervals: [
          { start: "12:00", end: "15:00" },
          { start: "19:00", end: "24:00" },
        ],
      },
    });
    const second = week({
      sat: {
        closed: false,
        intervals: [
          { start: "19:00", end: "24:00" },
          { start: "12:00", end: "15:00" },
        ],
      },
    });
    expect(encodeOpeningHours(first)).toBe(encodeOpeningHours(second));
  });

  it("treats a day with no intervals as closed", () => {
    const hours = week({ sat: { closed: false, intervals: [] } });
    expect(encodeOpeningHours(hours)).toBe("mon-fri 09:00-17:00; sat-sun closed");
  });
});

describe("parseOpeningHours", () => {
  it("round-trips the canonical form", () => {
    const encoded = encodeOpeningHours(defaultOpeningHours());
    const parsed = parseOpeningHours(encoded);
    expect(parsed).not.toBeNull();
    expect(encodeOpeningHours(parsed as OpeningHours)).toBe(encoded);
  });

  it("expands a day range across every day it covers", () => {
    const parsed = parseOpeningHours("mon-sun 00:00-24:00");
    expect(parsed).not.toBeNull();
    for (const day of DAYS) {
      expect((parsed as OpeningHours)[day]).toEqual({
        closed: false,
        intervals: [{ start: "00:00", end: "24:00" }],
      });
    }
  });

  it("rejects prose and partial weeks rather than guessing", () => {
    expect(parseOpeningHours("9am-5pm")).toBeNull();
    expect(parseOpeningHours("mon 09:00-17:00")).toBeNull();
    expect(parseOpeningHours("funday 09:00-17:00")).toBeNull();
  });
});

describe("isValidOpeningHours", () => {
  it("accepts the default week", () => {
    expect(isValidOpeningHours(defaultOpeningHours())).toBe(true);
  });

  it("rejects a span that ends before it starts", () => {
    const hours = week({ mon: { closed: false, intervals: [{ start: "17:00", end: "09:00" }] } });
    expect(isValidOpeningHours(hours)).toBe(false);
  });

  it("rejects an open day with no hours", () => {
    const hours = week({ mon: { closed: false, intervals: [] } });
    expect(isValidOpeningHours(hours)).toBe(false);
  });
});
