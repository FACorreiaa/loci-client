import { describe, expect, it } from "vitest";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { Trip } from "~/lib/api/trips";
import { tripToMarkdown } from "./trip-markdown";

const sample: Trip = {
  id: "t1",
  userId: "u1",
  cityName: "Lisbon",
  title: "Weekend in Lisbon",
  stays: [],
  flights: [],
  constraints: {
    pace: TripPace.MODERATE,
    mobility: "walking",
    interests: ["food", "history"],
  },
  version: 1n,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  days: [
    {
      id: "d1",
      dayNumber: 1,
      stops: [
        {
          id: "s1",
          poiId: "p1",
          orderIndex: 0,
          name: "Time Out Market",
          startMinute: 12 * 60,
          durationMinutes: 90,
          notes: "Highly rated market that fits your search.",
        },
      ],
    },
  ],
};

describe("tripToMarkdown", () => {
  it("includes title city and why-this notes", () => {
    const md = tripToMarkdown(sample);
    expect(md).toContain("# Weekend in Lisbon");
    expect(md).toContain("Lisbon");
    expect(md).toContain("Time Out Market");
    expect(md).toContain("Why this:");
    expect(md).toContain("## Day 1");
  });
});
