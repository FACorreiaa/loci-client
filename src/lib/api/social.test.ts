import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));

import { create } from "@bufbuild/protobuf";
import {
  PublicUserSchema,
  Relationship,
} from "@buf/loci_loci-proto.bufbuild_es/loci/social/social_pb.js";
import { initials, mapPublicUser, mapRelationship, profilePath } from "./social";

describe("social mappers", () => {
  it("falls back to the username when there is no display name", () => {
    const u = mapPublicUser(create(PublicUserSchema, { id: "1", username: "rui" }))!;
    expect(u.displayName).toBe("rui");
    expect(mapPublicUser(undefined)).toBeUndefined();
  });

  it("maps every relationship, unknown when signed out", () => {
    expect(mapRelationship(Relationship.UNSPECIFIED)).toBe("unknown");
    expect(mapRelationship(Relationship.INCOMING)).toBe("incoming");
    expect(mapRelationship(Relationship.FRIENDS)).toBe("friends");
    expect(mapRelationship(Relationship.SELF)).toBe("self");
  });

  it("makes initials for avatar placeholders", () => {
    expect(initials({ displayName: "Ana Maria Sousa", username: "ana" })).toBe("AS");
    expect(initials({ displayName: "", username: "rui" })).toBe("R");
  });

  it("links a profile by username only", () => {
    expect(profilePath({ username: "ana.s" })).toBe("/u/ana.s");
    expect(profilePath({ username: "" })).toBeUndefined();
  });
});

import {
  AchievementSummarySchema,
  AchievementTier as Tier,
} from "@buf/loci_loci-proto.bufbuild_es/loci/achievement/achievement_pb.js";
import {
  FeedCitySchema,
  FeedItemKind,
  FeedItemSchema,
  FeedTripSchema,
  FollowState,
} from "@buf/loci_loci-proto.bufbuild_es/loci/social/social_pb.js";
import { isFriend, mapFeedItem, mapFollowState, withCheer, type FeedPage } from "./social";

describe("following", () => {
  it("maps every follow state, unknown when signed out", () => {
    expect(mapFollowState(FollowState.UNSPECIFIED)).toBe("unknown");
    expect(mapFollowState(FollowState.REQUESTED)).toBe("requested");
    expect(mapFollowState(FollowState.FOLLOWING)).toBe("following");
    expect(mapFollowState(FollowState.SELF)).toBe("self");
  });

  it("calls a mutual follow a friend, and only that", () => {
    expect(isFriend({ state: "following", followsYou: true })).toBe(true);
    expect(isFriend({ state: "following", followsYou: false })).toBe(false);
    expect(isFriend({ state: "requested", followsYou: true })).toBe(false);
  });
});

describe("feed mappers", () => {
  const actor = create(PublicUserSchema, { id: "a", username: "ana", displayName: "Ana" });

  it("maps each kind with its detail", () => {
    const ach = mapFeedItem(
      create(FeedItemSchema, {
        id: "1",
        kind: FeedItemKind.ACHIEVEMENT_UNLOCKED,
        actor,
        detail: {
          case: "achievement",
          value: create(AchievementSummarySchema, {
            id: "trailhead",
            title: "Trailhead",
            tier: Tier.GOLD,
          }),
        },
        cheerCount: 2,
        cheeredByMe: true,
        recentCheerers: [create(PublicUserSchema, { id: "r", username: "rui" })],
      }),
    )!;
    expect(ach.detail).toMatchObject({
      kind: "achievement",
      achievement: { id: "trailhead", tier: "gold" },
    });
    expect(ach).toMatchObject({ cheers: 2, cheeredByMe: true });
    expect(ach.cheerers.map((u) => u.username)).toEqual(["rui"]);

    const city = mapFeedItem(
      create(FeedItemSchema, {
        kind: FeedItemKind.NEW_CITY,
        actor,
        detail: {
          case: "city",
          value: create(FeedCitySchema, { cityName: "Porto", country: "Portugal" }),
        },
      }),
    )!;
    expect(city.detail).toEqual({ kind: "city", cityName: "Porto", country: "Portugal" });

    const trip = mapFeedItem(
      create(FeedItemSchema, {
        kind: FeedItemKind.TRIP_FINISHED,
        actor,
        detail: {
          case: "trip",
          value: create(FeedTripSchema, { tripId: "t", title: "Douro", days: 3 }),
        },
      }),
    )!;
    expect(trip.detail).toMatchObject({ kind: "trip", finished: true, days: 3 });
  });

  it("drops a kind it does not know, or one without its detail", () => {
    expect(
      mapFeedItem(create(FeedItemSchema, { kind: 99 as FeedItemKind, actor })),
    ).toBeUndefined();
    expect(
      mapFeedItem(create(FeedItemSchema, { kind: FeedItemKind.NEW_CITY, actor })),
    ).toBeUndefined();
  });

  it("applies a cheer to the one item it names", () => {
    const item = (id: string) => ({
      id,
      actor: mapPublicUser(actor)!,
      createdAt: "",
      detail: { kind: "city" as const, cityName: "Porto", country: "" },
      cheers: 0,
      cheeredByMe: false,
      cheerers: [],
    });
    const data = {
      pages: [{ items: [item("1"), item("2")], next: "" }] as FeedPage[],
      pageParams: [""],
    };
    const out = withCheer(data, "2", 1, true)!;
    expect(out.pages[0].items[1]).toMatchObject({ cheers: 1, cheeredByMe: true });
    expect(out.pages[0].items[0]).toMatchObject({ cheers: 0, cheeredByMe: false });
    expect(withCheer(undefined, "2", 1, true)).toBeUndefined();
  });
});
