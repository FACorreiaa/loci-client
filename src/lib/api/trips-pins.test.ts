import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { mapTrip, toProtoStop, type TripStop } from "./trips";

const trip = (stop: Record<string, unknown>) =>
  mapTrip(
    create(TripDraftSchema, {
      id: "t1",
      title: "Lisbon",
      version: 1n,
      days: [{ id: "d1", dayNumber: 1, stops: [{ id: "s1", name: "Stop", ...stop }] }],
    }),
  ).days[0].stops[0];

describe("a trip stop's own pin", () => {
  it("is read with its address", () => {
    const stop = trip({ latitude: 38.7139, longitude: -9.1335, address: "Largo da Sé" });
    expect(stop.latitude).toBe(38.7139);
    expect(stop.longitude).toBe(-9.1335);
    expect(stop.address).toBe("Largo da Sé");
  });

  it("is absent when the server sent none", () => {
    const stop = trip({});
    expect(stop.latitude).toBeUndefined();
    expect(stop.longitude).toBeUndefined();
    expect(stop.address).toBeUndefined();
  });

  it("goes back whole or not at all", () => {
    const base: TripStop = { id: "s1", name: "Stop", orderIndex: 0 } as TripStop;
    const whole = toProtoStop({ ...base, latitude: 38.7, longitude: -9.1, address: "Rua A" });
    expect([whole.latitude, whole.longitude, whole.address]).toEqual([38.7, -9.1, "Rua A"]);
    const half = toProtoStop({ ...base, latitude: 38.7 });
    expect(half.latitude).toBeUndefined();
    expect(half.longitude).toBeUndefined();
  });
});
