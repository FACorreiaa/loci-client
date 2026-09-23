import { describe, expect, it, vi } from "vitest";
import {
  isOnRunPage,
  nounFor,
  orphanedRunIds,
  pushOutcome,
  retryHref,
  runToast,
} from "./watcher-rules";

describe("watcher rules", () => {
  const url = "/itinerary?sessionId=s1&cityName=Crete&domain=itinerary";
  const noop = () => {};

  it("knows when you are already looking at the result", () => {
    expect(
      isOnRunPage("/itinerary", "?sessionId=s1&cityName=Crete&domain=itinerary", url, "s1"),
    ).toBe(true);
    expect(isOnRunPage("/nearme", "", url, "s1")).toBe(false);
    expect(isOnRunPage("/itinerary", "?sessionId=other", url, "s1")).toBe(false);
  });

  it("counts the page hosting a run inline as its own page", () => {
    // /chat renders its runs in the conversation; their url is /itinerary.
    expect(isOnRunPage("/chat", "", url, "s1", "/chat")).toBe(true);
    expect(isOnRunPage("/discover", "", url, "s1", "/chat")).toBe(false);
    // A list page hosts the run it started, keyed by the session param.
    const host = "/nearme?sessionId=s1";
    expect(isOnRunPage("/nearme", "?sessionId=s1", "/itinerary?sessionId=s1", "s1", host)).toBe(
      true,
    );
    expect(isOnRunPage("/nearme", "?sessionId=s2", "/itinerary?sessionId=s1", "s1", host)).toBe(
      false,
    );
  });

  it("derives the noun from the result page's path, not a domain string", () => {
    expect(nounFor("/itinerary?sessionId=s1")).toBe("itinerary");
    expect(nounFor("/activities?sessionId=s1")).toBe("activities");
    expect(nounFor("/hotels?sessionId=s1")).toBe("hotels");
    expect(nounFor("/restaurants?sessionId=s1")).toBe("restaurants");
    expect(nounFor("/nearme?sessionId=s1")).toBe("nearby places");
    expect(nounFor("/something-else?sessionId=s1")).toBe("itinerary");
    expect(nounFor("")).toBe("itinerary");
  });

  it("words a finished run with the verb its noun takes", () => {
    const done = (u: string, city = "Lisbon") =>
      runToast({ sessionId: "s1", phase: "complete", city, url: u }, noop).title;
    expect(done(url, "Crete")).toBe("Your Crete itinerary is ready");
    expect(done("/hotels?sessionId=s1")).toBe("Your Lisbon hotels are ready");
    expect(done("/restaurants?sessionId=s1")).toBe("Your Lisbon restaurants are ready");
    expect(done("/activities?sessionId=s1")).toBe("Your Lisbon activities are ready");
    expect(done("/nearme?sessionId=s1")).toBe("Your Lisbon nearby places are ready");
    const open = runToast({ sessionId: "s1", phase: "complete", city: "Crete", url }, noop);
    expect(open.action).toEqual({ label: "Open", href: url });
  });

  it("retries a failed run by re-asking its query on its result route", () => {
    const go = vi.fn();
    const failedUrl = "/hotels?sessionId=s1&cityName=Lisbon";
    const failed = runToast(
      { sessionId: "s1", phase: "error", city: "Lisbon", url: failedUrl, query: "cheap hotels" },
      go,
    );
    expect(failed.title).toBe("Your Lisbon hotels didn't finish");
    expect(failed.action?.label).toBe("Retry");
    // Not a link to the failed session: that url carries no query.
    expect(failed.action?.href).toBeUndefined();
    failed.action?.run?.();
    expect(go).toHaveBeenCalledWith("/hotels?message=cheap+hotels&cityName=Lisbon");
  });

  it("offers a new search when the failed run's query is unknown", () => {
    const go = vi.fn();
    const relayed = runToast(
      { sessionId: "s1", phase: "error", city: "", url: "/hotels?sessionId=s1" },
      go,
    );
    expect(relayed.title).toBe("Your hotels didn't finish");
    expect(relayed.action?.label).toBe("New search");
    relayed.action?.run?.();
    expect(go).toHaveBeenCalledWith("/");
  });

  it("builds retry links for every result route", () => {
    expect(retryHref({ url: url, query: "2 days", city: "Crete" })).toBe(
      "/itinerary?message=2+days&cityName=Crete",
    );
    expect(retryHref({ url: "/nearme?sessionId=s1", query: "near", city: "" })).toBe(
      "/nearme?message=near",
    );
    expect(retryHref({ url: "", query: "x", city: "Porto" })).toBe(
      "/itinerary?message=x&cityName=Porto",
    );
  });

  it("settles only the runs nobody resumed and this tab did not see finish", () => {
    const done = new Set(["finished-here"]);
    expect(
      orphanedRunIds(["resumed", "finished-here", "orphan"], new Set(["resumed"]), (id) =>
        done.has(id),
      ),
    ).toEqual(["orphan"]);
  });

  it("handles what the push offer's Allow comes back with", () => {
    expect(pushOutcome("granted")).toBe("refresh");
    expect(pushOutcome("error")).toEqual({
      id: "push-error",
      title: "Couldn't turn on notifications on this device.",
    });
    expect(pushOutcome("denied")).toBeNull();
    expect(pushOutcome("off")).toBeNull();
  });
});
