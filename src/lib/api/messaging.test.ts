import { describe, expect, it } from "vitest";
import { telegramDeepLink } from "./messaging";

// The deep link has one job: produce the message the server parses. Telegram
// delivers `?start=CODE` as the text "/start CODE", and messaging/service.go
// reads exactly that, so a malformed link is a link that silently never links.
describe("telegramDeepLink", () => {
  it("builds a t.me start link", () => {
    expect(telegramDeepLink("loci_bot", "ABCD2345")).toBe("https://t.me/loci_bot?start=ABCD2345");
  });

  // The server reports the handle as people write it, with the @.
  it("strips a leading @ from the handle", () => {
    expect(telegramDeepLink("@loci_bot", "ABCD2345")).toBe("https://t.me/loci_bot?start=ABCD2345");
  });

  it("ignores surrounding whitespace", () => {
    expect(telegramDeepLink("  loci_bot ", "ABCD2345")).toBe(
      "https://t.me/loci_bot?start=ABCD2345",
    );
  });

  // No bot handle means the deployment has no bot token. An empty string is the
  // signal to show the code on its own rather than a link to nowhere.
  it.each([
    ["", "ABCD2345"],
    ["@", "ABCD2345"],
    ["loci_bot", ""],
  ])("returns nothing for handle %j and code %j", (handle, code) => {
    expect(telegramDeepLink(handle, code)).toBe("");
  });

  it("escapes a code that would otherwise change the query", () => {
    expect(telegramDeepLink("loci_bot", "A&b=c")).toBe("https://t.me/loci_bot?start=A%26b%3Dc");
  });
});
