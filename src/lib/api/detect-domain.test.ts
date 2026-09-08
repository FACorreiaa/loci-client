import { describe, expect, it } from "vitest";
import { detectDomain } from "./llm";

// detectDomain decides which page a search lands on, so getting it wrong sends
// an itinerary request to /activities and the user sees an empty panel.
//
// The old implementation used unanchored substring regexes with no word
// boundaries, and tested activities BEFORE itinerary. Its `activities`
// alternation contained the fragments `see` and `do`, and `dining` contained
// `bar` and `eat`. So:
//
//   "3 day itinerary for London"  -> activities   ("Lon-do-n")
//   "3 days in Barcelona"         -> dining       ("Bar-celona")
//   "3 days in Seattle"           -> dining       ("S-eat-tle")
//
// Every row below is a real thing somebody would type.
describe("detectDomain", () => {
  describe("place names must not decide the domain", () => {
    it.each([
      ["3 day itinerary for London", "itinerary", "Lon-do-n contains 'do'"],
      ["3 days in Barcelona", "itinerary", "Bar-celona contains 'bar'"],
      ["3 days in Seattle", "itinerary", "S-eat-tle contains 'eat'"],
      ["a week in Doha", "itinerary", "Do-ha contains 'do'"],
      ["two days in Cordoba", "itinerary", "Cor-do-ba contains both 'do' and 'bar'"],
    ])("%j -> %s (%s)", (message, want) => {
      expect(detectDomain(message)).toBe(want);
    });
  });

  // An explicit itinerary request stays an itinerary request even when it
  // mentions what the days should contain. This is the landing page's own
  // placeholder text, which routed to /restaurants.
  describe("a multi-day request is an itinerary, whatever it mentions", () => {
    it.each([
      ["three chill days in Lisbon for food and views", "itinerary"],
      ["2 days · Porto · wine", "itinerary"],
      ["plan me a weekend in Funchal", "itinerary"],
      ["day trip from Funchal", "itinerary"],
      ["1 week route through Madeira", "itinerary"],
    ])("%j -> %s", (message, want) => {
      expect(detectDomain(message)).toBe(want);
    });
  });

  describe("a single-subject request keeps its own domain", () => {
    it.each([
      ["hotels in Porto", "accommodation"],
      ["where should I stay in Funchal", "accommodation"],
      ["cheap hostel near the old town", "accommodation"],
      ["best restaurants in Funchal", "dining"],
      ["somewhere to eat near the market", "dining"],
      ["a bar with a view", "dining"],
      // A count of nights is a stay length, not a trip length. Counting it as
      // a trip marker sent this to /itinerary.
      ["Book a room for 2 nights", "accommodation"],
      ["what to see in Funchal", "activities"],
      ["museums in Madeira", "activities"],
      ["things to do with kids", "activities"],
      ["levada walks", "activities"],
    ])("%j -> %s", (message, want) => {
      expect(detectDomain(message)).toBe(want);
    });
  });

  describe("nothing recognisable is general, not a guess", () => {
    it.each([[""], ["   "], ["asdfghjkl"], ["Funchal"]])("%j -> general", (message) => {
      expect(detectDomain(message)).toBe("general");
    });
  });

  it("is case-insensitive", () => {
    expect(detectDomain("HOTELS IN PORTO")).toBe("accommodation");
    expect(detectDomain("3 Day Itinerary For London")).toBe("itinerary");
  });
});
