import { describe, expect, it } from "vitest";
import {
  claimStatusText,
  flattenMyClaims,
  type MyClaim,
  type MyClaimsPage,
  MY_CLAIMS_PAGE_SIZE,
  nextMyClaimsPage,
  REMOVED_PLACE_NAME,
  toMyClaim,
} from "./my-claims";

describe("toMyClaim", () => {
  it("keeps the place, labels the field, reads the hours and words the status", () => {
    const claim = toMyClaim({
      claimId: "c-1",
      poiId: "p-1",
      poiName: "Tasca do Chico",
      field: "PLACE_FACT_FIELD_OPENING_HOURS",
      value: "mon-fri 12:00-23:00; sat-sun closed",
      status: "PENDING",
      createdAt: new Date("2026-09-20T10:00:00Z"),
    });
    expect(claim.id).toBe("c-1");
    expect(claim.placeName).toBe("Tasca do Chico");
    expect(claim.placeExists).toBe(true);
    expect(claim.fieldLabel).toBe("Opening Hours");
    expect(claim.value).toBe("mon-fri 12:00-23:00; sat-sun closed");
    expect(claim.valueText).toBe("Mon–Fri 12:00–23:00 · Sat–Sun closed");
    expect(claim.statusText).toBe("Recorded");
    expect(claim.createdAt?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });

  it("shows a token as the label the picker offered", () => {
    const claim = toMyClaim({
      claimId: "c-3",
      poiId: "p-3",
      poiName: "Café",
      field: "PLACE_FACT_FIELD_DIETARY",
      value: "gluten_free",
      status: "ACCEPTED",
    });
    expect(claim.valueText).toBe("Gluten free");
  });

  it("reads an older comma-joined multi-answer value, keeping unknown tokens", () => {
    const claim = toMyClaim({
      claimId: "c-4",
      poiId: "p-4",
      poiName: "Café",
      field: "PLACE_FACT_FIELD_ACCESSIBILITY",
      value: "step_free, lift,ramp",
      status: "CONTRADICTED",
    });
    expect(claim.valueText).toBe("Step-free entrance, Lift, ramp");
    expect(claim.statusText).toBe("Noted — reports differ");
  });

  it("names a removed place rather than showing a blank, and does not link it", () => {
    const claim = toMyClaim({
      claimId: "c-2",
      poiId: "p-2",
      poiName: "  ",
      field: "PLACE_FACT_FIELD_VIBE",
      value: "lively",
      status: "ACCEPTED",
    });
    expect(claim.placeName).toBe(REMOVED_PLACE_NAME);
    expect(claim.placeExists).toBe(false);
    expect(claim.statusText).toBe("Verified");
  });
});

describe("claimStatusText", () => {
  it("uses ClaimResult's words for the same outcome", () => {
    expect(claimStatusText("ACCEPTED")).toBe("Verified");
    expect(claimStatusText("CONTRADICTED")).toBe("Noted — reports differ");
    expect(claimStatusText("PENDING")).toBe("Recorded");
    expect(claimStatusText("UNSPECIFIED")).toBe("Recorded");
    expect(claimStatusText("EXPIRED")).toBe("Expired");
  });
});

const claim = (id: string): MyClaim =>
  toMyClaim({
    claimId: id,
    poiId: `p-${id}`,
    poiName: `Place ${id}`,
    field: "PLACE_FACT_FIELD_PRICE_LEVEL",
    value: "budget",
    status: "PENDING",
  });

const page = (number: number, ids: string[], total: number): MyClaimsPage => ({
  page: number,
  claims: ids.map(claim),
  total,
});

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => String(from + index));

describe("nextMyClaimsPage", () => {
  it("asks for page 1 before anything has loaded", () => {
    expect(nextMyClaimsPage([])).toBe(1);
  });

  it("asks for the next page while the server reports more", () => {
    expect(MY_CLAIMS_PAGE_SIZE).toBe(20);
    expect(nextMyClaimsPage([page(1, ids(1, 20), 45)])).toBe(2);
    expect(nextMyClaimsPage([page(1, ids(1, 20), 45), page(2, ids(21, 20), 45)])).toBe(3);
  });

  it("stops once every claim is loaded", () => {
    expect(nextMyClaimsPage([page(1, ids(1, 20), 20)])).toBeUndefined();
    expect(
      nextMyClaimsPage([
        page(1, ids(1, 20), 45),
        page(2, ids(21, 20), 45),
        page(3, ids(41, 5), 45),
      ]),
    ).toBeUndefined();
  });

  it("stops on a short or empty page even if the total says otherwise", () => {
    expect(nextMyClaimsPage([page(1, ids(1, 7), 50)])).toBeUndefined();
    expect(nextMyClaimsPage([page(1, ids(1, 20), 50), page(2, [], 50)])).toBeUndefined();
  });

  it("uses the newest page's total, which moves when a report is filed between loads", () => {
    expect(nextMyClaimsPage([page(1, ids(1, 20), 20), page(2, ids(20, 20), 41)])).toBe(3);
  });
});

describe("flattenMyClaims", () => {
  it("keeps page order and drops a row repeated across a page boundary", () => {
    const rows = flattenMyClaims([page(1, ["a", "b"], 4), page(2, ["b", "c", "d"], 4)]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("is empty with no pages", () => {
    expect(flattenMyClaims([])).toEqual([]);
  });
});
