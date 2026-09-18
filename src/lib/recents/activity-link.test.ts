import { describe, it, expect } from "vitest";
import { activityHref } from "./activity-link";
import type { ActivityEntry } from "./types";

const entry = (over: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e1",
  kind: "prompt",
  detail: "itinerary",
  label: "three days in Porto",
  cityName: "Porto",
  refId: "sess-1",
  occurredAt: new Date().toISOString(),
  ...over,
});

describe("activityHref", () => {
  it("routes each domain to the page that answers it", () => {
    const cases: Array<[string, string]> = [
      ["itinerary", "/itinerary"],
      ["general", "/itinerary"],
      ["accommodation", "/hotels"],
      ["dining", "/restaurants"],
      ["activities", "/activities"],
      ["nearby", "/nearme"],
    ];
    for (const [detail, path] of cases) {
      expect(activityHref(entry({ detail })).split("?")[0]).toBe(path);
    }
  });

  // The whole feature turns on this. The result pages restore a past session
  // from a single sessionStorage slot, so anything but the most recent stream
  // in the current tab restores nothing and re-runs the query instead. Without
  // the message in the URL there is no query to re-run and every row lands on
  // "tell Loci what you're looking for".
  it("carries the original message so a row that cannot restore can re-run", () => {
    const params = new URLSearchParams(
      activityHref(entry({ detail: "dining", label: "seafood in Cascais" })).split("?")[1],
    );
    expect(params.get("message")).toBe("seafood in Cascais");
    expect(params.get("sessionId")).toBe("sess-1");
    expect(params.get("cityName")).toBe("Porto");
  });

  it("passes the search profile through when there is one", () => {
    const withProfile = new URLSearchParams(activityHref(entry({}), "profile-9").split("?")[1]);
    expect(withProfile.get("profileId")).toBe("profile-9");

    const without = new URLSearchParams(activityHref(entry({})).split("?")[1]);
    expect(without.get("profileId")).toBeNull();
  });

  it("opens a kept trip through its chat session, and the list when it has none", () => {
    expect(
      activityHref(entry({ kind: "saved_itinerary", detail: "itinerary", refId: "sess-7" })),
    ).toContain("/itinerary?sessionId=sess-7");
    expect(activityHref(entry({ kind: "saved_itinerary", detail: "itinerary", refId: "" }))).toBe(
      "/bookmarks",
    );
  });

  it("sends a favourite to the page its content type has", () => {
    expect(activityHref(entry({ kind: "favourite", detail: "hotel", refId: "h1" }))).toBe(
      "/hotels/h1",
    );
    expect(activityHref(entry({ kind: "favourite", detail: "restaurant", refId: "r1" }))).toBe(
      "/restaurants/r1",
    );
    expect(activityHref(entry({ kind: "favourite", detail: "itinerary", refId: "i1" }))).toBe(
      "/bookmarks",
    );
    // There is no POI detail route, so a place goes to the list it lives in
    // rather than to a 404.
    expect(activityHref(entry({ kind: "favourite", detail: "poi", refId: "p1" }))).toBe(
      "/favorites",
    );
  });
});
