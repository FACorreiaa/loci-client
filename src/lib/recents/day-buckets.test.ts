import { describe, it, expect } from "vitest";
import { bucketByDay, relativeTime } from "./day-buckets";
import type { ActivityEntry } from "./types";

const at = (date: Date): ActivityEntry => ({
  id: date.toISOString(),
  kind: "prompt",
  detail: "general",
  label: "something",
  cityName: "Porto",
  refId: "s",
  occurredAt: date.toISOString(),
});

const hoursBefore = (base: Date, h: number) => new Date(base.getTime() - h * 3600_000);

describe("bucketByDay", () => {
  // The boundary is calendar days in the viewer's timezone, not elapsed hours.
  // At 00:30 an entry from 23:50 is forty minutes old and still belongs under
  // Yesterday; bucketing on elapsed time would file it under Today.
  it("puts last night under Yesterday when read just after midnight", () => {
    const now = new Date(2026, 8, 18, 0, 30);
    const lastNight = new Date(2026, 8, 17, 23, 50);

    const groups = bucketByDay([at(lastNight)], now);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("yesterday");
  });

  it("separates today, yesterday, this week and earlier", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = bucketByDay(
      [
        at(hoursBefore(now, 2)),
        at(new Date(2026, 8, 17, 9, 0)),
        at(new Date(2026, 8, 14, 9, 0)),
        at(new Date(2026, 6, 1, 9, 0)),
      ],
      now,
    );

    expect(groups.map((g) => g.key)).toEqual(["today", "yesterday", "week", "earlier"]);
    expect(groups.every((g) => g.entries.length === 1)).toBe(true);
  });

  it("drops groups that would render empty", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = bucketByDay([at(hoursBefore(now, 1))], now);
    expect(groups.map((g) => g.key)).toEqual(["today"]);
  });

  it("keeps the order it was given inside a group", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const newer = at(hoursBefore(now, 1));
    const older = at(hoursBefore(now, 5));

    const groups = bucketByDay([newer, older], now);

    expect(groups[0].entries.map((e) => e.id)).toEqual([newer.id, older.id]);
  });

  it("files an unparseable timestamp under Earlier rather than crashing", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const broken = { ...at(now), occurredAt: "not a date" };
    const groups = bucketByDay([broken], now);
    expect(groups[0].key).toBe("earlier");
  });
});

describe("relativeTime", () => {
  it("shortens with distance", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    expect(relativeTime(new Date(now.getTime() - 30_000).toISOString(), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(relativeTime(new Date(now.getTime() - 3 * 3600_000).toISOString(), now)).toBe("3h ago");
    expect(relativeTime(new Date(2026, 8, 17, 9, 0).toISOString(), now)).toBe("yesterday");
    expect(relativeTime(new Date(2026, 8, 15, 9, 0).toISOString(), now)).toBe("3d ago");
  });

  it("is empty for a timestamp it cannot read", () => {
    expect(relativeTime("nope", new Date())).toBe("");
  });
});
