import { describe, expect, it } from "vitest";
import { ContextEntityType } from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import { contextFromPath } from "./context";

const id = "3f2b8c1e-7d4a-4e9b-a1c2-0f9e8d7c6b5a";

describe("contextFromPath", () => {
  it("names the home screen", () => {
    expect(contextFromPath("/")).toEqual({ screen: "home", entities: [] });
  });

  it("reads the id off a detail route", () => {
    expect(contextFromPath(`/trips/${id}`)).toEqual({
      screen: "trip_detail",
      entities: [{ type: ContextEntityType.TRIP, id }],
    });
    expect(contextFromPath(`/lists/${id}`).entities[0].type).toBe(ContextEntityType.LIST);
    expect(contextFromPath(`/places/${id}`).entities[0].type).toBe(ContextEntityType.POI);
  });

  it("does not mistake a sub-route for an id", () => {
    expect(contextFromPath("/lists/import")).toEqual({ screen: "lists", entities: [] });
  });

  it("falls back to the first segment", () => {
    expect(contextFromPath("/saved")).toEqual({ screen: "saved", entities: [] });
    expect(contextFromPath("/settings/account").screen).toBe("settings");
  });
});
