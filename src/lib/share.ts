/**
 * Social sharing utilities.
 *
 * Constructs share payloads with "Generated from Loci" branding for:
 * - Web Share API (mobile native share sheet)
 * - Twitter/X direct link
 * - Facebook direct link
 * - WhatsApp direct link
 * - Copy-to-clipboard fallback
 */

export interface SharePayload {
  cityName: string;
  title: string;
  description?: string;
  url: string;
  stopCount?: number;
}

const SIGNATURE = "Generated from Loci ✨";

function buildShareText(payload: SharePayload): string {
  const lines: string[] = [];
  lines.push(`📍 ${payload.title}`);
  if (payload.description) {
    // Truncate for social media (Twitter 280 char limit)
    const desc =
      payload.description.length > 120
        ? payload.description.slice(0, 117) + "…"
        : payload.description;
    lines.push(desc);
  }
  if (payload.stopCount && payload.stopCount > 0) {
    lines.push(`🗺️ ${payload.stopCount} stops`);
  }
  lines.push("");
  lines.push(SIGNATURE);
  return lines.join("\n");
}

/** Try Web Share API; returns true if it succeeded. */
export async function shareNative(payload: SharePayload): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({
      title: `${payload.title} — ${SIGNATURE}`,
      text: buildShareText(payload),
      url: payload.url,
    });
    return true;
  } catch (e) {
    // User cancelled or API error
    if ((e as DOMException)?.name !== "AbortError") {
      console.error("Share failed:", e);
    }
    return false;
  }
}

/** Twitter/X intent URL. */
export function twitterShareUrl(payload: SharePayload): string {
  const text = buildShareText(payload);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(payload.url)}`;
}

/** Facebook share URL. */
export function facebookShareUrl(payload: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}&quote=${encodeURIComponent(buildShareText(payload))}`;
}

/** WhatsApp share URL. */
export function whatsappShareUrl(payload: SharePayload): string {
  const text = `${buildShareText(payload)}\n${payload.url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Copy share text + URL to clipboard. */
export async function copyShareToClipboard(payload: SharePayload): Promise<boolean> {
  try {
    const text = `${buildShareText(payload)}\n${payload.url}`;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
