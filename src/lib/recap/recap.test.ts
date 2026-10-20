import { describe, expect, it, vi } from "vitest";
import {
  countLabel,
  evidenceLine,
  fetchSharedRecapMeta,
  formatKm,
  initials,
  isLightCard,
  monthName,
  monthShort,
  percentileMetricLabel,
  playableCards,
  projectPins,
  recapName,
  recapImageUrl,
  routeBasisCaption,
  sharedRecapMeta,
  trendLabel,
  tripHasEnded,
  yearInReviewYear,
} from "./recap";

const now = new Date(2026, 9, 16, 12, 0, 0); // 16 Oct 2026, local

describe("tripHasEnded", () => {
  it("is over the day after the end date", () => {
    expect(tripHasEnded({ endDate: "2026-10-15", days: [] }, now)).toBe(true);
    expect(tripHasEnded({ endDate: "2026-10-16", days: [] }, now)).toBe(false);
    expect(tripHasEnded({ endDate: "2026-11-01", days: [] }, now)).toBe(false);
  });

  it("falls back to the last dated day", () => {
    const days = [
      { date: new Date(2026, 9, 12, 9).toISOString() },
      { date: new Date(2026, 9, 14, 9).toISOString() },
    ];
    expect(tripHasEnded({ days }, now)).toBe(true);
    expect(tripHasEnded({ days: [{ date: new Date(2026, 9, 20, 9).toISOString() }] }, now)).toBe(
      false,
    );
  });

  it("is over once every day is walked, whatever the dates say", () => {
    expect(
      tripHasEnded(
        { endDate: "2026-12-01", days: [{ completedAt: "x" }, { completedAt: "y" }] },
        now,
      ),
    ).toBe(true);
    expect(tripHasEnded({ endDate: "2026-12-01", days: [{ completedAt: "x" }, {}] }, now)).toBe(
      false,
    );
  });

  it("an undated, unwalked trip has no recap", () => {
    expect(tripHasEnded({ days: [{}] }, now)).toBe(false);
    expect(tripHasEnded({ days: [] }, now)).toBe(false);
  });
});

describe("wording", () => {
  it("formats distances", () => {
    expect(formatKm(41.2)).toBe("41 km");
    expect(formatKm(1204.4)).toBe("1,204 km");
    expect(formatKm(0.8)).toBe("0.8 km");
    expect(formatKm(3)).toBe("3 km");
    expect(formatKm(NaN)).toBe("0 km");
  });

  it("names what the distance measures", () => {
    expect(routeBasisCaption(2)).toBe("as the crow flies between cities");
    expect(routeBasisCaption(0)).toBe("");
  });

  it("cites evidence", () => {
    expect(evidenceLine(7, 1)).toBe("From 7 saves");
    expect(evidenceLine(1, 2)).toBe("From 1 visit");
    expect(evidenceLine(0, 1)).toBe("");
    expect(trendLabel(3)).toBe("Strong");
  });

  it("makes initials", () => {
    expect(initials("Ana Sousa")).toBe("AS");
    expect(initials("rui")).toBe("R");
    expect(initials("  ")).toBe("?");
  });
});

describe("shared recap preview", () => {
  const api = "https://api.lociai.fyi";

  it("builds title, description and image", () => {
    const meta = sharedRecapMeta(api, "abc", {
      title: "Lisbon",
      subtitle: "5 days · Oct 2026",
      owner: { displayName: "Fernando" },
      cards: [{}, { outro: { summaryLine: "23 places · 41 km · 5 days" } }],
    });
    expect(meta).toEqual({
      title: "Fernando's Lisbon recap",
      description: "23 places · 41 km · 5 days. Plan your own trip with Loci.",
      image: "https://api.lociai.fyi/recap-img/abc/og.png",
    });
    expect(sharedRecapMeta(api, "abc", {})).toBeUndefined();
  });

  it("fetches through Connect JSON and survives failures", async () => {
    const ok = vi.fn(async () =>
      Response.json({ recap: { title: "Porto", subtitle: "2 days · Sep 2026" } }),
    );
    const meta = await fetchSharedRecapMeta(api, "xyz", ok as unknown as typeof fetch);
    expect(meta?.title).toBe("Porto recap");
    expect(ok).toHaveBeenCalledWith(
      `${api}/loci.recap.RecapService/GetSharedRecap`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ shareCode: "xyz" }) }),
    );

    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    expect(
      await fetchSharedRecapMeta(api, "x", notFound as unknown as typeof fetch),
    ).toBeUndefined();
    const boom = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await fetchSharedRecapMeta(api, "x", boom as unknown as typeof fetch)).toBeUndefined();
  });

  it("encodes image paths", () => {
    expect(recapImageUrl("https://a/", "a b", "og")).toBe("https://a/recap-img/a%20b/og.png");
  });
});

describe("cards", () => {
  it("skips cards this build cannot draw", () => {
    const cards = [
      { id: "a", card: { case: "intro" } },
      { id: "b", card: { case: undefined } },
      { id: "c", card: { case: "someFutureCard" } },
      { id: "d", card: { case: "outro" } },
    ];
    expect(playableCards(cards).map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("knows which cards are light", () => {
    expect(isLightCard({ card: { case: "places" } })).toBe(true);
    expect(isLightCard({ card: { case: "intro" } })).toBe(false);
    expect(isLightCard(undefined)).toBe(false);
  });
});

describe("year in review", () => {
  it("offers this year in December and last year in January only", () => {
    expect(yearInReviewYear(new Date(2026, 11, 1))).toBe(2026);
    expect(yearInReviewYear(new Date(2027, 0, 31))).toBe(2026);
    expect(yearInReviewYear(new Date(2027, 1, 1))).toBeUndefined();
    expect(yearInReviewYear(new Date(2026, 10, 30))).toBeUndefined();
  });

  it("names months and counts", () => {
    expect(monthShort(6)).toBe("Jun");
    expect(monthName(12)).toBe("December");
    expect(monthShort(0)).toBe("");
    expect(monthName(13)).toBe("");
    expect(countLabel(1, "city", "cities")).toBe("1 city");
    expect(countLabel(1204, "place", "places")).toBe("1,204 places");
    expect(countLabel(-3, "day", "days")).toBe("0 days");
  });

  it("says what a percentile ranks", () => {
    expect(percentileMetricLabel(1)).toBe("for places kept");
    expect(percentileMetricLabel(4)).toBe("for giving back");
    expect(percentileMetricLabel(99)).toBe("for places kept");
  });

  it("projects pins inside the box, keeping their order", () => {
    const pins = projectPins(
      [
        { latitude: 38.72, longitude: -9.14 },
        { latitude: 41.15, longitude: -8.61 },
        { latitude: Number.NaN, longitude: 0 },
        { latitude: 40.42, longitude: -3.7 },
      ],
      100,
      60,
      8,
    );
    expect(pins.map((p) => p.i)).toEqual([0, 1, 3]);
    for (const p of pins) {
      expect(p.x).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(92 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(52 + 1e-9);
    }
    // Madrid is east of Lisbon; Porto is north of it.
    expect(pins[2].x).toBeGreaterThan(pins[0].x);
    expect(pins[1].y).toBeLessThan(pins[0].y);
    expect(projectPins([{ latitude: 1, longitude: 2 }], 100, 60, 8)).toEqual([
      { x: 50, y: 30, i: 0 },
    ]);
    expect(projectPins([], 100, 60, 8)).toEqual([]);
  });

  it("plays and shades the year cards", () => {
    const cards = ["yearMap", "tripsTimeline", "streak", "percentile"].map((c) => ({
      card: { case: c },
    }));
    expect(playableCards(cards)).toHaveLength(4);
    expect(isLightCard({ card: { case: "yearMap" } })).toBe(true);
    expect(isLightCard({ card: { case: "tripsTimeline" } })).toBe(false);
    expect(isLightCard({ card: { case: "streak" } })).toBe(false);
  });
});

describe("recap names", () => {
  it("names trips and years for a sentence", () => {
    expect(recapName({ title: "Lisbon", kind: 1 })).toBe("Lisbon recap");
    expect(recapName({ title: "Your 2026", kind: 2, year: 2026 })).toBe("2026 in Loci");
    expect(recapName({ title: "Your 2026", kind: "RECAP_KIND_YEAR", year: 2026 })).toBe(
      "2026 in Loci",
    );
  });

  it("previews a shared year without 'Your'", () => {
    const meta = sharedRecapMeta("https://api", "c", {
      kind: "RECAP_KIND_YEAR",
      year: 2026,
      title: "Your 2026",
      owner: { displayName: "Ana" },
    });
    expect(meta?.title).toBe("Ana's 2026 in Loci");
  });
});
