import { describe, expect, it } from "vitest";
import { badgeNameFromSlug, toContributorBadges } from "./badges";

describe("toContributorBadges", () => {
  it("uses the server's display name and description, in its order", () => {
    expect(
      toContributorBadges(
        ["first_report", "night_owl"],
        [
          { slug: "first_report", displayName: "First report", description: "Filed a report." },
          { slug: "night_owl", displayName: "Night owl", description: "Checked hours after 10pm." },
        ],
      ),
    ).toEqual([
      { slug: "first_report", name: "First report", description: "Filed a report." },
      { slug: "night_owl", name: "Night owl", description: "Checked hours after 10pm." },
    ]);
  });

  it("falls back to the slug when badge_details is absent (older server)", () => {
    expect(toContributorBadges(["first_report", "verified-5"], [])).toEqual([
      { slug: "first_report", name: "First report", description: "" },
      { slug: "verified-5", name: "Verified 5", description: "" },
    ]);
  });

  it("falls back to the slug for a detail without a display name", () => {
    expect(
      toContributorBadges(["local"], [{ slug: "local", displayName: " ", description: "" }]),
    ).toEqual([{ slug: "local", name: "Local", description: "" }]);
  });

  it("keeps a slug missing from the details and never lists one twice", () => {
    expect(
      toContributorBadges(
        ["a", "b", "a"],
        [{ slug: "a", displayName: "Alpha", description: "First." }],
      ).map((badge) => badge.name),
    ).toEqual(["Alpha", "B"]);
  });

  it("is empty with no badges", () => {
    expect(toContributorBadges([], [])).toEqual([]);
  });
});

describe("badgeNameFromSlug", () => {
  it("returns the slug untouched when there is nothing to read", () => {
    expect(badgeNameFromSlug("__")).toBe("__");
  });
});
