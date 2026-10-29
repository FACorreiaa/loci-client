import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import { timestampFromDate, TimestampSchema } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ListTripCommentsResponseSchema,
  ReportedTripCommentSchema,
  TripCommentSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/members_pb.js";
import {
  commentErrorMessage,
  cursorTimestamp,
  flattenCommentPages,
  mapComment,
  mapReportedComment,
  olderCommentsCursor,
  toCommentsPage,
  type TripCommentsPage,
} from "./trip-comments";

describe("mapComment", () => {
  it("maps a stop comment and a trip comment", () => {
    const at = new Date("2026-10-23T10:00:00Z");
    const c = mapComment(
      create(TripCommentSchema, {
        id: "c1",
        tripId: "t1",
        stopId: "s1",
        author: { id: "u2", username: "rui", displayName: "Rui" },
        body: "Best at sunset",
        createdAt: timestampFromDate(at),
        mine: false,
        canDelete: true,
      }),
    );
    expect(c).toMatchObject({
      id: "c1",
      stopId: "s1",
      body: "Best at sunset",
      createdAt: at.toISOString(),
      canDelete: true,
      mine: false,
    });
    expect(c.author?.displayName).toBe("Rui");
    expect(mapComment(create(TripCommentSchema, { id: "c2" })).stopId).toBeUndefined();
  });
});

describe("commentErrorMessage", () => {
  it.each([
    [Code.ResourceExhausted, "", "a lot of comments"],
    [Code.InvalidArgument, "that stop is not on the trip", "no longer on the trip"],
    [Code.InvalidArgument, "a comment is 1 to 2000 characters", "1 to 2000"],
    [Code.NotFound, "", "no longer here"],
    [Code.PermissionDenied, "", "author or the trip's planner"],
  ])("code %s", (code, msg, want) => {
    expect(commentErrorMessage(new ConnectError(msg, code))).toContain(want);
  });
  it("anything else asks to retry", () => {
    expect(commentErrorMessage(new Error("boom"))).toContain("Try again");
  });
});

const comment = (id: string, seconds: number, nanos = 0) =>
  create(TripCommentSchema, {
    id,
    tripId: "t1",
    body: id,
    createdAt: create(TimestampSchema, { seconds: BigInt(seconds), nanos }),
  });

const page = (ids: [string, number][], hasMore: boolean): TripCommentsPage =>
  toCommentsPage(
    create(ListTripCommentsResponseSchema, {
      comments: ids.map(([id, s]) => comment(id, s)),
      hasMore,
    }),
  );

describe("trip comment pages", () => {
  it("cursors on the oldest comment, keeping sub-millisecond precision", () => {
    const p = toCommentsPage(
      create(ListTripCommentsResponseSchema, {
        comments: [comment("a", 1_700_000_000, 123_456_789), comment("b", 1_700_000_100)],
        hasMore: true,
      }),
    );
    const cursor = olderCommentsCursor(p);
    expect(cursor).toEqual({ seconds: "1700000000", nanos: 123_456_789 });
    const ts = cursorTimestamp(cursor!);
    expect(ts.seconds).toBe(1_700_000_000n);
    expect(ts.nanos).toBe(123_456_789);
  });

  it("offers no older page when the server says there is none", () => {
    expect(olderCommentsCursor(page([["a", 10]], false))).toBeUndefined();
    expect(olderCommentsCursor(page([], true))).toBeUndefined();
    expect(olderCommentsCursor(null)).toBeUndefined();
  });

  it("flattens newest-first pages into one oldest-first list", () => {
    const newest = page(
      [
        ["c", 30],
        ["d", 40],
      ],
      true,
    );
    const older = page(
      [
        ["a", 10],
        ["b", 20],
      ],
      false,
    );
    const out = flattenCommentPages({ pages: [newest, older], pageParams: [undefined, {}] });
    expect(out.comments.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.hasMore).toBe(false);
  });

  it("is still more while the oldest page loaded says so", () => {
    const newest = page([["c", 30]], true);
    expect(flattenCommentPages({ pages: [newest], pageParams: [undefined] }).hasMore).toBe(true);
  });

  it("skips the server-render placeholder and duplicate ids", () => {
    const newest = page(
      [
        ["b", 20],
        ["c", 30],
      ],
      true,
    );
    const older = page(
      [
        ["a", 10],
        ["b", 20],
      ],
      false,
    );
    expect(flattenCommentPages({ pages: [null], pageParams: [undefined] })).toEqual({
      comments: [],
      hasMore: false,
    });
    expect(
      flattenCommentPages({ pages: [newest, older], pageParams: [] }).comments.map((c) => c.id),
    ).toEqual(["a", "b", "c"]);
    expect(flattenCommentPages(undefined)).toEqual({ comments: [], hasMore: false });
  });
});

describe("reported trip comments", () => {
  it("maps counts, reasons, non-empty details and the hidden flag", () => {
    const r = mapReportedComment(
      create(ReportedTripCommentSchema, {
        comment: comment("x", 100),
        reportCount: 3,
        reasons: [
          { reason: "spam", count: 2 },
          { reason: "other", count: 1 },
        ],
        details: ["selling stuff", "  "],
        lastReportedAt: create(TimestampSchema, { seconds: 0n }),
        hidden: true,
      }),
    );
    expect(r.comment?.id).toBe("x");
    expect(r.reportCount).toBe(3);
    expect(r.reasons).toEqual([
      { reason: "spam", count: 2 },
      { reason: "other", count: 1 },
    ]);
    expect(r.details).toEqual(["selling stuff"]);
    expect(r.lastReportedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(r.hidden).toBe(true);
  });
});
