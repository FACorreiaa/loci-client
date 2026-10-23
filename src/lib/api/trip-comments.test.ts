import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { TripCommentSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/members_pb.js";
import { commentErrorMessage, mapComment } from "./trip-comments";

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
