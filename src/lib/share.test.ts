import { describe, expect, it } from "vitest";
import {
  buildShareText,
  SHARE_HOME_URL,
  SIGNATURE,
  telegramShareUrl,
  twitterShareUrl,
  whatsappShareUrl,
  type SharePayload,
} from "./share";

const payload: SharePayload = {
  cityName: "London",
  title: "London in 3 days",
  url: SHARE_HOME_URL,
  stops: [
    { name: "Tower of London", day: 0 },
    { name: "Borough Market", day: 0 },
    { name: "Tate Modern", day: 0 },
    { name: "British Museum", day: 1 },
    { name: "Camden Market", day: 1 },
    { name: "Greenwich", day: 2 },
  ],
};

describe("buildShareText", () => {
  it("lists the stops by day, then signs off", () => {
    expect(buildShareText(payload)).toBe(
      [
        "London in 3 days",
        "Day 1 · Tower of London, Borough Market, Tate Modern",
        "Day 2 · British Museum, Camden Market",
        "Day 3 · Greenwich",
        "",
        SIGNATURE,
      ].join("\n"),
    );
  });

  it("signs with plain words, no emoji", () => {
    expect(SIGNATURE).toBe("Generated from Loci");
    expect(buildShareText(payload)).not.toMatch(/[\u{1F300}-\u{1FAFF}✨]/u);
  });

  it("groups undated stops four to a day", () => {
    const undated: SharePayload = {
      ...payload,
      stops: ["a", "b", "c", "d", "e"].map((name) => ({ name })),
    };
    const text = buildShareText(undated);
    expect(text).toContain("Day 1 · a, b, c, d");
    expect(text).toContain("Day 2 · e");
  });

  it("caps long days and long trips instead of pasting everything", () => {
    const stops = Array.from({ length: 40 }, (_, i) => ({
      name: `Stop ${i + 1}`,
      day: Math.floor(i / 8),
    }));
    const text = buildShareText({ ...payload, stops });
    expect(text).toContain("Day 1 · Stop 1, Stop 2, Stop 3, Stop 4 +4 more");
    expect(text).toContain("Day 4");
    expect(text).not.toContain("Day 5");
    expect(text).toContain("+1 more day");
  });

  it("writes a flat list as one line, with no days", () => {
    const text = buildShareText({
      cityName: "Rome",
      title: "Hotels in Rome",
      url: SHARE_HOME_URL,
      stopCount: 8,
      items: ["A", "B", "C", "D", "E", "F", "G", "H"],
    });
    expect(text.split("\n")).toEqual(["Hotels in Rome", "A, B, C, D, E, F +2 more", "", SIGNATURE]);
    expect(text).not.toContain("Day 1");
  });

  it("falls back to a stop count, then to the description, when there are no stops", () => {
    expect(buildShareText({ ...payload, stops: [], stopCount: 7 })).toContain("7 stops");
    expect(
      buildShareText({ ...payload, stops: undefined, description: "A slow weekend by the river." }),
    ).toContain("A slow weekend by the river.");
  });
});

describe("share links", () => {
  it("carry the text and the Loci link", () => {
    const text = buildShareText(payload);
    expect(twitterShareUrl(payload)).toContain(encodeURIComponent(text));
    expect(twitterShareUrl(payload)).toContain(encodeURIComponent(SHARE_HOME_URL));
    expect(whatsappShareUrl(payload)).toContain(encodeURIComponent(`${text}\n${SHARE_HOME_URL}`));
    expect(telegramShareUrl(payload)).toContain(`url=${encodeURIComponent(SHARE_HOME_URL)}`);
    expect(telegramShareUrl(payload)).toContain(encodeURIComponent(text));
  });
});

describe("a prepared share text", () => {
  it("is used as-is (a multi-city trip writes its own, grouped by city)", () => {
    const text = "Lisbon → Porto\n\nLisbon\nDay 1 — Belém\n\nGenerated from Loci";
    expect(buildShareText({ cityName: "Lisbon + Porto", title: "t", url: "u", text })).toBe(text);
  });
});
