import { describe, expect, it } from "vitest";
import { isOnRunPage, nounFor, runToast } from "./watcher-rules";

describe("watcher rules", () => {
  const url = "/itinerary?sessionId=s1&cityName=Crete&domain=itinerary";

  it("knows when you are already looking at the result", () => {
    expect(
      isOnRunPage("/itinerary", "?sessionId=s1&cityName=Crete&domain=itinerary", url, "s1"),
    ).toBe(true);
    expect(isOnRunPage("/nearme", "", url, "s1")).toBe(false);
    expect(isOnRunPage("/itinerary", "?sessionId=other", url, "s1")).toBe(false);
  });

  it("derives the noun from the result page's path, not a domain string", () => {
    expect(nounFor("/itinerary?sessionId=s1")).toBe("itinerary");
    expect(nounFor("/activities?sessionId=s1")).toBe("activities");
    expect(nounFor("/hotels?sessionId=s1")).toBe("hotels");
    expect(nounFor("/restaurants?sessionId=s1")).toBe("restaurants");
    expect(nounFor("/nearme?sessionId=s1")).toBe("nearby places");
    expect(nounFor("/something-else?sessionId=s1")).toBe("itinerary");
  });

  it("words a finished and a failed run", () => {
    expect(runToast({ sessionId: "s1", phase: "complete", city: "Crete", url }).title).toBe(
      "Your Crete itinerary is ready",
    );
    const failedUrl = "/hotels?sessionId=s1&cityName=Lisbon";
    const failed = runToast({ sessionId: "s1", phase: "error", city: "", url: failedUrl });
    expect(failed.title).toBe("Your hotels didn't finish");
    expect(failed.action?.label).toBe("Retry");
    expect(failed.action?.href).toBe(failedUrl);
  });

  it("words a finished nearby-places run", () => {
    const nearUrl = "/nearme?sessionId=s1&cityName=Lisbon";
    expect(
      runToast({ sessionId: "s1", phase: "complete", city: "Lisbon", url: nearUrl }).title,
    ).toBe("Your Lisbon nearby places is ready");
  });
});
