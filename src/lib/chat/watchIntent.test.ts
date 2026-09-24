import { describe, expect, it } from "vitest";
import { looksLikeWatchRequest } from "./watchIntent";

describe("looksLikeWatchRequest", () => {
  it.each([
    "Watch hotel prices in Lisbon for October",
    "keep an eye on flights to Porto",
    "Tell me when it's going to rain in Funchal",
    "let me know if the Prado gets late opening hours",
    "notify me when tickets for the Alhambra drop",
    "Every morning, check the weather in Madrid",
    "every day at 8 send me a restaurant in Rome",
    "each Friday suggest a weekend trip from Porto",
    "Remind me every week to check train fares",
    "ping me daily with a hidden gem in Paris",
    "Check every 3 hours whether the Sagrada Família has tickets",
    "Keep me posted on events in Berlin",
    "alert me if museum hours change",
    "hourly: bike availability near Alfama",
  ])("offers a standing task for %j", (text) => {
    expect(looksLikeWatchRequest(text)).toBe(true);
  });

  it.each([
    "Hidden gems in Paris",
    "3-day cultural tour of Rome",
    "Best food markets in Italy",
    "What should I watch out for in Naples?",
    "Where can I watch the sunset in Lisbon?",
    "tell me about Évora",
    "Is it worth visiting Sintra every time I'm in Lisbon?",
    "Restaurants open every day in Porto",
    "",
    "   ",
  ])("leaves %j to the normal chat", (text) => {
    expect(looksLikeWatchRequest(text)).toBe(false);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(looksLikeWatchRequest("  TELL ME WHEN the Louvre reopens  ")).toBe(true);
  });
});
