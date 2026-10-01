import { describe, expect, it } from "vitest";
import { claimStatusText, REMOVED_PLACE_NAME, toMyClaim } from "./my-claims";

describe("toMyClaim", () => {
  it("keeps the place, labels the field and words the status", () => {
    const claim = toMyClaim({
      claimId: "c-1",
      poiId: "p-1",
      poiName: "Tasca do Chico",
      field: "PLACE_FACT_FIELD_OPENING_HOURS",
      value: "Mon–Fri 12:00–23:00",
      status: "PENDING",
      createdAt: new Date("2026-09-20T10:00:00Z"),
    });
    expect(claim.id).toBe("c-1");
    expect(claim.placeName).toBe("Tasca do Chico");
    expect(claim.fieldLabel).toBe("Opening Hours");
    expect(claim.statusText).toBe("Waiting on a second scout");
    expect(claim.createdAt?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });

  it("names a removed place rather than showing a blank", () => {
    const claim = toMyClaim({
      claimId: "c-2",
      poiId: "p-2",
      poiName: "",
      field: "PLACE_FACT_FIELD_VIBE",
      value: "lively",
      status: "ACCEPTED",
    });
    expect(claim.placeName).toBe(REMOVED_PLACE_NAME);
    expect(claim.statusText).toBe("Verified");
  });
});

describe("claimStatusText", () => {
  it("uses the claim form's own words", () => {
    expect(claimStatusText("PENDING")).toBe("Waiting on a second scout");
    expect(claimStatusText("ACCEPTED")).toBe("Verified");
    expect(claimStatusText("CONTRADICTED")).toBe("Reports differ");
    expect(claimStatusText("EXPIRED")).toBe("Expired");
    expect(claimStatusText("UNSPECIFIED")).toBe("Recorded");
  });
});
