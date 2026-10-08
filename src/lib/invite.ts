/**
 * Inviting someone to Loci.
 *
 * The system share sheet is the product: on a phone it is where Messages,
 * WhatsApp, Facebook and Messenger appear, and the person's own apps send the
 * invite. Loci does not pick friends and does not send texts. Where there is
 * no share sheet (most desktops) the fallbacks are a copied link, an `sms:`
 * link, and Facebook's public sharer — none needs a Meta app or a key.
 *
 * The invite code from a link someone opened is kept in localStorage until
 * the next sign-in or sign-up sends it, so it survives the OAuth popup and a
 * detour through sign-in.
 */
import { copyText } from "./clipboard";
import type { NativeShareResult } from "./share";

export interface ShareableInvite {
  url: string;
  /** The message, without the url. */
  shareText: string;
}

/** Text and link as one string, for channels that take one (SMS, clipboard). */
export const inviteMessage = (inv: ShareableInvite) => `${inv.shareText} ${inv.url}`.trim();

/** The system share sheet. Title, text and url are separate items, so the url is not repeated. */
export async function shareInvite(inv: ShareableInvite): Promise<NativeShareResult> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unavailable";
  }
  const data: ShareData = { title: "Loci", text: inv.shareText, url: inv.url };
  if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
    return "unavailable";
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "cancelled";
    return "failed";
  }
}

/** Opens the person's messaging app with the invite typed in. Their carrier sends it. */
export const smsInviteHref = (inv: ShareableInvite) =>
  `sms:?&body=${encodeURIComponent(inviteMessage(inv))}`;

/** Facebook's public sharer: shares the link, needs no Meta app, lists no friends. */
export const facebookInviteHref = (inv: ShareableInvite) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inv.url)}`;

export const copyInviteLink = (inv: ShareableInvite) => copyText(inv.url);

// --- The code from a link someone opened ---------------------------------

const PENDING_KEY = "loci_invite_code";
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODE_LEN = 64;

/** Keeps the code from an invite link until the next sign-up sends it. */
export function rememberInvite(code: string): void {
  if (!code || code.length > MAX_CODE_LEN) return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* storage disabled: the signup simply carries no code */
  }
}

/** The remembered invite code, if one is waiting and not stale. */
export function pendingInviteCode(): string | undefined {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return undefined;
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof code !== "string" || typeof at !== "number" || Date.now() - at > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return undefined;
    }
    return code;
  } catch {
    return undefined;
  }
}

/** Forgets the code. Called after any successful sign-in, whether or not it applied. */
export function clearInvite(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to clear */
  }
}
