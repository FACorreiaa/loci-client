import { describe, expect, it } from "vitest";
import { flagFor, groupByCountry, loadSnapshot, saveSnapshot, timeAgo, type NewsTickerData } from "./ticker";

const now = new Date("2026-09-17T12:00:00Z");

describe("timeAgo", () => {
  it("is coarse and never a timestamp", () => {
    expect(timeAgo("2026-09-17T11:59:40Z", now)).toBe("now");
    expect(timeAgo("2026-09-17T11:30:00Z", now)).toBe("30m");
    expect(timeAgo("2026-09-17T09:00:00Z", now)).toBe("3h");
    expect(timeAgo("2026-09-14T12:00:00Z", now)).toBe("3d");
    expect(timeAgo("garbage", now)).toBe("");
  });
});

describe("flagFor", () => {
  it("renders regional indicators and nothing for unknown input", () => {
    expect(flagFor("PT")).toBe("🇵🇹");
    expect(flagFor("es")).toBe("🇪🇸");
    expect(flagFor("")).toBe("");
    expect(flagFor("USA")).toBe("");
  });
});

const data: NewsTickerData = {
  enabled: true,
  stale: false,
  countryCodes: ["PT", "ES"],
  items: [
    { id: "a", title: "A", url: "https://x/a", source: "S", publishedAt: "2026-09-17T11:00:00Z", countryCode: "ES" },
    { id: "b", title: "B", url: "https://x/b", source: "S", publishedAt: "2026-09-17T10:00:00Z", countryCode: "PT" },
    { id: "c", title: "C", url: "https://x/c", source: "S", publishedAt: "2026-09-17T09:00:00Z", countryCode: "" },
  ],
};

describe("groupByCountry", () => {
  it("keeps the server's country order and parks unknowns at the end", () => {
    const groups = groupByCountry(data);
    expect(groups.map((g) => g.code)).toEqual(["PT", "ES", ""]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("snapshot", () => {
  it("round-trips through storage and tolerates garbage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(loadSnapshot(storage)).toBeUndefined();
    saveSnapshot(storage, data, now);
    expect(loadSnapshot(storage)?.data.items).toHaveLength(3);
    expect(loadSnapshot(storage)?.savedAt).toBe(now.toISOString());
    store.set("loci-news-ticker-snapshot", "{not json");
    expect(loadSnapshot(storage)).toBeUndefined();
    expect(loadSnapshot(undefined)).toBeUndefined();
  });
});
