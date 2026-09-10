import { describe, expect, it } from "vitest";
import { formatMessageContent } from "./format-message-content";

// Persisted assistant turns come back from the server as the raw stream
// payloads, tagged and concatenated in whatever order the sections finished:
//
//   [city_data]\n{...}\n\n[general_pois]\n{...}\n\n[itinerary]\n{...}
//
// The server is being fixed to store prose, but until every old session is
// gone the client must never put JSON in a chat bubble.

const CITY = JSON.stringify({
  city: "Funchal",
  country: "Portugal",
  description: "Madeira's capital, terraced above a wide bay.",
});

const POIS = JSON.stringify({
  points_of_interest: [
    { name: "Mercado dos Lavradores", category: "market" },
    { name: "Monte Palace", category: "garden" },
  ],
});

const ITINERARY = JSON.stringify({
  itinerary_name: "Two days in Funchal",
  points_of_interest: [
    { name: "Sé Cathedral", category: "landmark" },
    { name: "Monte Palace", category: "garden" },
    { name: "Cabo Girão", category: "viewpoint" },
  ],
});

const looksRaw = (s: string) => /^[[{]/.test(s.trim());

describe("formatMessageContent", () => {
  describe("multi-part tagged blobs", () => {
    const orderA = `[city_data]\n${CITY}\n\n[general_pois]\n${POIS}\n\n[itinerary]\n${ITINERARY}`;
    const orderB = `[itinerary]\n${ITINERARY}\n\n[city_data]\n${CITY}\n\n[general_pois]\n${POIS}`;

    it("produces the same sentence regardless of section order", () => {
      expect(formatMessageContent(orderA)).toBe(formatMessageContent(orderB));
    });

    it("prefers the itinerary section", () => {
      const out = formatMessageContent(orderA);
      expect(out).toContain("3 places");
      expect(out).toContain("Sé Cathedral");
    });

    it("never starts with a bracket or brace", () => {
      expect(looksRaw(formatMessageContent(orderA))).toBe(false);
      expect(looksRaw(formatMessageContent(orderB))).toBe(false);
    });

    it("falls through to the next section when the preferred one is broken", () => {
      const broken = `[itinerary]\n{not json\n\n[city_data]\n${CITY}`;
      expect(formatMessageContent(broken)).toMatch(/^Let me tell you about Funchal, Portugal/);
    });

    it("uses the domain and city for the fallback when nothing parses", () => {
      const out = formatMessageContent(
        `[hotels]\n{"city":"Funchal","hotels":[oops\n\n[city_data]\n{broken`,
      );
      expect(looksRaw(out)).toBe(false);
      expect(out).toContain("hotel");
      expect(out).toContain("for Funchal");
    });
  });

  describe("single tagged blob", () => {
    it("turns city data into a sentence", () => {
      const out = formatMessageContent(`[city_data]${CITY}`);
      expect(out.startsWith("Let me tell you about Funchal, Portugal")).toBe(true);
    });

    it("turns city data on its own line into the same sentence", () => {
      expect(formatMessageContent(`[city_data]\n${CITY}`)).toBe(
        formatMessageContent(`[city_data]${CITY}`),
      );
    });

    it("handles a json fence inside the section", () => {
      const out = formatMessageContent("[city_data]\n```json\n" + CITY + "\n```");
      expect(out.startsWith("Let me tell you about Funchal, Portugal")).toBe(true);
    });

    it("falls back to a completion sentence when the body is not JSON", () => {
      const out = formatMessageContent('[restaurants]\n{"city":"Porto", "restaurants": [');
      expect(looksRaw(out)).toBe(false);
      expect(out).toContain("restaurants");
      expect(out).toContain("for Porto");
    });

    it("reads well when no city can be found", () => {
      const out = formatMessageContent("[activities]\n{broken");
      expect(out).not.toMatch(/\s\./);
      expect(out).not.toMatch(/\s{2,}/);
    });

    it("shows prose under a tag as prose, without the tag", () => {
      const out = formatMessageContent("[itinerary]\nHere is your plan for Funchal.");
      expect(out).toBe("Here is your plan for Funchal.");
    });
  });

  describe("plain text", () => {
    it("passes markdown through unchanged", () => {
      const md =
        "**Funchal** is lovely.\n\n- Monte Palace\n- Cabo Girão\n\n[Book here](https://example.com)";
      expect(formatMessageContent(md)).toBe(md);
    });

    it("passes text that starts with a markdown link through unchanged", () => {
      const md = "[Monte Palace](https://example.com) is worth the cable car.";
      expect(formatMessageContent(md)).toBe(md);
    });

    it("passes a short answer through unchanged", () => {
      expect(formatMessageContent("Sure, what dates?")).toBe("Sure, what dates?");
    });
  });

  describe("untagged JSON", () => {
    it("formats a bare city payload", () => {
      expect(formatMessageContent(CITY)).toMatch(/^Let me tell you about Funchal, Portugal/);
    });

    it("formats a bare array of places", () => {
      const out = formatMessageContent(
        JSON.stringify([
          { name: "Taberna Ruel", category: "restaurant", cuisine_type: "Madeiran" },
          { name: "Kampo", category: "restaurant", cuisine_type: "Modern" },
        ]),
      );
      expect(out).toContain("2 great restaurants");
    });

    it("replaces unparseable JSON with a completion sentence", () => {
      const out = formatMessageContent("{garbage");
      expect(looksRaw(out)).toBe(false);
      expect(out.length).toBeGreaterThan(20);
    });

    it("never echoes a parsed-but-unrecognised object", () => {
      const out = formatMessageContent('{"foo": 1}');
      expect(looksRaw(out)).toBe(false);
    });
  });
});
