import { describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  JournalDaySchema,
  JournalStopSchema,
  JournalVisitSchema,
  TripJournalSchema,
  TripPhotoSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/journal/journal_pb.js";
import { Verdict } from "@buf/loci_loci-proto.bufbuild_es/loci/ranking/ranking_pb.js";
import { VisitSource } from "@buf/loci_loci-proto.bufbuild_es/loci/travelhistory/travelhistory_pb.js";
import { fitWithin } from "./resize";
import { putHeaders, uploadPhoto, type UploadDeps } from "./upload";
import { dayHeading, toJournalView, visitedCount } from "./view";

describe("fitWithin", () => {
  it("scales the long edge down to the limit and keeps the ratio", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never scales up", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("keeps at least one pixel on a sliver", () => {
    expect(fitWithin(10000, 1, 2048)).toEqual({ width: 2048, height: 1 });
  });
});

describe("uploadPhoto", () => {
  const deps = (overrides: Partial<UploadDeps> = {}) => {
    const calls: string[] = [];
    const d: UploadDeps = {
      create: vi.fn(async () => {
        calls.push("create");
        return {
          photoId: "p1",
          uploadUrl: "https://media.lociai.fyi/put",
          headers: { "Content-Type": "image/jpeg", "Content-Length": "3", Host: "x" },
        };
      }),
      put: vi.fn(async () => {
        calls.push("put");
        return { ok: true, status: 200 };
      }),
      confirm: vi.fn(async () => {
        calls.push("confirm");
        return { id: "p1", url: "https://media.lociai.fyi/get", caption: "" };
      }),
      remove: vi.fn(async () => {
        calls.push("remove");
      }),
      ...overrides,
    };
    return { d, calls };
  };
  const blob = new Blob(["abc"], { type: "image/jpeg" });

  it("signs, sends the bytes, then confirms", async () => {
    const { d, calls } = deps();
    const photo = await uploadPhoto(d, { tripId: "t1", dayId: "d1" }, blob);
    expect(calls).toEqual(["create", "put", "confirm"]);
    expect(photo.id).toBe("p1");
    expect(d.create).toHaveBeenCalledWith({
      tripId: "t1",
      dayId: "d1",
      stopId: undefined,
      contentType: "image/jpeg",
      sizeBytes: 3,
    });
    // The browser sets Content-Length and Host itself and refuses them from script.
    expect(d.put).toHaveBeenCalledWith("https://media.lociai.fyi/put", blob, {
      "Content-Type": "image/jpeg",
    });
  });

  it("removes the pending photo when the bytes don't arrive", async () => {
    const { d, calls } = deps({
      put: vi.fn(async () => ({ ok: false, status: 403 })),
    });
    await expect(uploadPhoto(d, { tripId: "t1" }, blob)).rejects.toThrow();
    expect(calls).toEqual(["create", "remove"]);
  });

  it("removes the pending photo when the confirm fails", async () => {
    const { d, calls } = deps({
      confirm: vi.fn(async () => {
        throw new Error("mismatch");
      }),
    });
    await expect(uploadPhoto(d, { tripId: "t1" }, blob)).rejects.toThrow("mismatch");
    expect(calls).toEqual(["create", "put", "remove"]);
  });

  it("refuses a file that is not a photo before asking the server", async () => {
    const { d, calls } = deps();
    await expect(
      uploadPhoto(d, { tripId: "t1" }, new Blob(["x"], { type: "image/gif" })),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it("drops only the headers a browser forbids", () => {
    expect(
      putHeaders({
        "content-length": "1",
        host: "h",
        "Content-Type": "image/png",
        "x-amz-acl": "a",
      }),
    ).toEqual({ "Content-Type": "image/png", "x-amz-acl": "a" });
  });
});

describe("toJournalView", () => {
  const at = (iso: string) => timestampFromDate(new Date(iso));
  const journal = create(TripJournalSchema, {
    tripId: "t1",
    title: "Lisbon weekend",
    cityName: "Lisbon",
    photosEnabled: true,
    days: [
      create(JournalDaySchema, {
        dayId: "d1",
        dayNumber: 1,
        date: at("2026-10-20T00:00:00Z"),
        cityName: "Lisbon",
        diary: "Rain all morning.",
        stops: [
          create(JournalStopSchema, {
            stopId: "s1",
            poiId: "belem",
            name: "Belém",
            startMinute: 600,
            visitedAt: at("2026-10-20T10:05:00Z"),
            verdict: Verdict.LOVED,
            photos: [create(TripPhotoSchema, { id: "p1", url: "u1", stopId: "s1" })],
          }),
          create(JournalStopSchema, { stopId: "s2", poiId: "alfama", name: "Alfama" }),
        ],
        extraVisits: [
          create(JournalVisitSchema, {
            poiId: "bar",
            name: "A Ginjinha",
            visitedAt: at("2026-10-20T23:30:00Z"),
            source: VisitSource.MANUAL,
          }),
        ],
      }),
    ],
    photos: [create(TripPhotoSchema, { id: "p9", url: "u9" })],
  });

  it("maps days, stops, verdicts, extras and photos", () => {
    const v = toJournalView(journal);
    expect(v.photosEnabled).toBe(true);
    expect(v.tripPhotos.map((p) => p.id)).toEqual(["p9"]);
    const day = v.days[0];
    expect(day.diary).toBe("Rain all morning.");
    expect(day.stops.map((s) => [s.name, s.verdict, !!s.visitedAt])).toEqual([
      ["Belém", "loved", true],
      ["Alfama", undefined, false],
    ]);
    expect(day.stops[0].photos.map((p) => p.id)).toEqual(["p1"]);
    expect(day.extras.map((e) => [e.name, e.source])).toEqual([["A Ginjinha", "manual"]]);
    expect(visitedCount(day)).toEqual({ visited: 1, planned: 2 });
  });

  it("heads a day with the calendar date it names, in any timezone", () => {
    // Midnight UTC on the 20th is the 19th in Los Angeles; the heading must
    // still say the 20th.
    const tz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const day = toJournalView(journal).days[0];
      expect(dayHeading(day, "en-GB")).toBe("Day 1 · Tue 20 Oct");
      expect(dayHeading({ ...day, date: undefined }, "en-GB")).toBe("Day 1");
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});
