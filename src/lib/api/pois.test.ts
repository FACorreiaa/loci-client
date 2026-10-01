import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));

import { create } from "@bufbuild/protobuf";
import { SearchPOIRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import { nearbySearchRequest } from "./pois";

describe("nearbySearchRequest", () => {
  it("sends the point and radius with an empty query", () => {
    const init = nearbySearchRequest({ latitude: 38.72, longitude: -9.14, radiusKm: 3 });
    expect(init).toEqual({ latitude: 38.72, longitude: -9.14, radiusKm: 3, searchType: "hybrid" });

    const req = create(SearchPOIRequestSchema, init!);
    expect(req.query).toBe("");
    expect(req.cityName).toBe("");
    expect(req.latitude).toBe(38.72);
    expect(req.longitude).toBe(-9.14);
    expect(req.radiusKm).toBe(3);
  });

  it("defaults the radius to 10 km", () => {
    expect(nearbySearchRequest({ latitude: 1, longitude: 2 })?.radiusKm).toBe(10);
  });

  it("accepts 0 as a coordinate", () => {
    expect(nearbySearchRequest({ latitude: 0, longitude: 0 })).not.toBeNull();
  });

  it("is null without a point", () => {
    expect(nearbySearchRequest()).toBeNull();
    expect(nearbySearchRequest({ latitude: 1 })).toBeNull();
  });
});
