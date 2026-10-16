import { describe, expect, it, vi } from "vitest";
import {
  evidenceLine,
  fetchSharedRecapMeta,
  formatKm,
  initials,
  isLightCard,
  playableCards,
  recapImageUrl,
  routeBasisCaption,
  sharedRecapMeta,
  trendLabel,
  tripHasEnded,
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
      { id: "c", card: { case: "yearMap" } },
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
