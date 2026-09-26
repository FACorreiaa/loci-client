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
