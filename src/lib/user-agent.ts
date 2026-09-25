/**
 * Turn a User-Agent string into something a person can recognise.
 *
 * The signed-in-devices screen exists to answer one question: which of these is
 * me, and which is not. It was rendering the raw header, so two different
 * browsers read as the same wall of text:
 *
 *   Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
 *   (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
 *
 * This is deliberately a short list of matches rather than a UA-parsing
 * dependency. The full string is kept and shown on hover, so nothing is lost
 * and a device we do not recognise degrades to the truth rather than to a
 * confident wrong answer.
 */

type Match = { pattern: RegExp; name: string };

// Order matters: every Chromium browser also claims Chrome, and every one of
// them claims Safari. Most specific first.
const BROWSERS: Match[] = [
  { pattern: /\bEdg[A-Z]?\//, name: "Edge" },
  { pattern: /\bOPR\/|\bOpera\//, name: "Opera" },
  { pattern: /\bVivaldi\//, name: "Vivaldi" },
  { pattern: /\bBrave\//, name: "Brave" },
  { pattern: /\bSamsungBrowser\//, name: "Samsung Internet" },
  { pattern: /\bFirefox\/|\bFxiOS\//, name: "Firefox" },
  { pattern: /\bCriOS\//, name: "Chrome" },
  { pattern: /\bChrome\//, name: "Chrome" },
  { pattern: /\bSafari\//, name: "Safari" },
];

// iPadOS claims to be a Mac, so iPad has to be tested before macOS.
const PLATFORMS: Match[] = [
  { pattern: /\biPhone\b/, name: "iPhone" },
  { pattern: /\biPad\b/, name: "iPad" },
  { pattern: /\bAndroid\b/, name: "Android" },
  { pattern: /\bWindows NT\b/, name: "Windows" },
  { pattern: /\bCrOS\b/, name: "ChromeOS" },
  { pattern: /\bMac OS X\b|\bMacintosh\b/, name: "macOS" },
  { pattern: /\bLinux\b/, name: "Linux" },
];

function firstMatch(ua: string, table: Match[]): string | null {
  for (const { pattern, name } of table) {
    if (pattern.test(ua)) return name;
  }
  return null;
}

/**
 * A short label like "Chrome on macOS".
 *
 * Returns "Unrecognised device" for an empty or unreadable agent rather than
 * guessing — on a security screen, an invented answer is worse than an honest
 * blank.
 */
export function describeUserAgent(userAgent: string | undefined | null): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "Unrecognised device";

  const browser = firstMatch(ua, BROWSERS);
  const platform = firstMatch(ua, PLATFORMS);

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;

  // Something we have no match for. Show the start of the real string rather
  // than claiming to know what it is.
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}
