/**
 * A QR code as a data URL, drawn in the browser.
 *
 * `qrcode` is imported on demand, never at module level: evaluating it inside
 * the Cloudflare Worker that server-renders pages hangs the render, and every
 * route whose module graph reached it (/friends, /profile) answered a direct
 * load with a stream that never finished — "Plotting your route…" forever.
 * Callers run this from a resource that only fetches in the browser.
 */
export async function qrDataUrl(text: string, width: number): Promise<string | null> {
  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toDataURL(text, { width, margin: 1 });
  } catch {
    return null;
  }
}
