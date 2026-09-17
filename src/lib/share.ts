/**
 * Social sharing for an itinerary.
 *
 * What goes out is the itinerary as text — title, the stops by day, and the
 * signature "Generated from Loci" — with the Loci home link. The link is the
 * landing page rather than the person's own /itinerary URL: that URL names a
 * private chat session which nobody else can open, and a share that lands on
 * an error is worse than none. When a public share route exists, swap the URL
 * here and nothing else changes.
 *
 * The native share sheet also gets the Loci mark as an image, where the
 * browser allows files. Web intents (X, WhatsApp, Telegram, Facebook) and the
 * clipboard are text only; that is a platform limit, not a choice.
 */
import { copyText } from "./clipboard";

export interface ShareStop {
  name: string;
  /** 0-based day, when the server said which. */
  day?: number;
}

export interface SharePayload {
  cityName: string;
  title: string;
  description?: string;
  url: string;
  stopCount?: number;
  stops?: ShareStop[];
}

export const SIGNATURE = "Generated from Loci";
export const SHARE_HOME_URL = "https://lociai.fyi";
/** The mark attached to a native share. PNG: the widest accepted by share targets. */
export const SHARE_IMAGE_PATH = "/images/brand/icon-192.png";

// Mirrors the page's own fallback when the server did not assign days.
const STOPS_PER_DAY = 4;
const MAX_NAMES_PER_DAY = 4;
const MAX_DAYS = 4;

const groupByDay = (stops: ShareStop[]): string[][] => {
  const days = new Map<number, string[]>();
  stops.forEach((stop, i) => {
    const day = typeof stop.day === "number" ? stop.day : Math.floor(i / STOPS_PER_DAY);
    const list = days.get(day) ?? [];
    list.push(stop.name);
    days.set(day, list);
  });
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => names);
};

const dayLine = (n: number, names: string[]): string => {
  const shown = names.slice(0, MAX_NAMES_PER_DAY).join(", ");
  const rest = names.length - MAX_NAMES_PER_DAY;
  return `Day ${n} · ${shown}${rest > 0 ? ` +${rest} more` : ""}`;
};

export function buildShareText(payload: SharePayload): string {
  const lines: string[] = [payload.title];
  const stops = payload.stops ?? [];

  if (stops.length > 0) {
    const days = groupByDay(stops);
    days.slice(0, MAX_DAYS).forEach((names, i) => lines.push(dayLine(i + 1, names)));
    const rest = days.length - MAX_DAYS;
    if (rest > 0) lines.push(`+${rest} more day${rest === 1 ? "" : "s"}`);
  } else if (payload.stopCount && payload.stopCount > 0) {
    lines.push(`${payload.stopCount} stops`);
  } else if (payload.description) {
    const desc = payload.description;
    lines.push(desc.length > 120 ? desc.slice(0, 117) + "…" : desc);
  }

  lines.push("", SIGNATURE);
  return lines.join("\n");
}

const textWithLink = (payload: SharePayload) => `${buildShareText(payload)}\n${payload.url}`;

export type NativeShareResult = "shared" | "cancelled" | "unavailable" | "failed";

async function shareImage(): Promise<File | undefined> {
  try {
    const res = await fetch(SHARE_IMAGE_PATH);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return new File([blob], "loci.png", { type: "image/png" });
  } catch {
    return undefined;
  }
}

/** The native share sheet, with the Loci mark attached where the browser allows it. */
export async function shareNative(payload: SharePayload): Promise<NativeShareResult> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unavailable";
  }
  const data: ShareData = {
    title: `${payload.title} — ${SIGNATURE}`,
    text: buildShareText(payload),
    url: payload.url,
  };
  const image = await shareImage();
  if (image && typeof navigator.canShare === "function" && navigator.canShare({ files: [image] })) {
    data.files = [image];
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "cancelled";
    console.error("Share failed:", e);
    return "failed";
  }
}

export function twitterShareUrl(payload: SharePayload): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(payload))}&url=${encodeURIComponent(payload.url)}`;
}

export function facebookShareUrl(payload: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}&quote=${encodeURIComponent(buildShareText(payload))}`;
}

export function whatsappShareUrl(payload: SharePayload): string {
  return `https://wa.me/?text=${encodeURIComponent(textWithLink(payload))}`;
}

export function telegramShareUrl(payload: SharePayload): string {
  return `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(buildShareText(payload))}`;
}

/** Text plus link to the clipboard, through the helper that survives non-secure contexts. */
export function copyShareToClipboard(payload: SharePayload): Promise<boolean> {
  return copyText(textWithLink(payload));
}
