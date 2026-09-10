// Pure state derivations for the Connections page.
//
// No JSX and no hooks: everything here is a function of plain values so it can
// be unit-tested without rendering, and so the components stay a thin layer of
// "which of these am I showing" over decisions that are written down once.
import type { ApiKeyView, ClientKind } from "~/lib/api/api-keys";
import { CLIENT_KINDS } from "~/lib/api/api-keys";
import type { MessagingLinkCode, MessagingLinkView } from "~/lib/api/messaging";

export const DEFAULT_AGENT: ClientKind = "claude_code";

/**
 * The agent a `?agent=` search param names.
 *
 * Absent → Claude Code, the most common client. Anything the app does not
 * know → "other", the generic MCP object: a link written for a client that was
 * renamed or removed should land on setup that works everywhere, not on a
 * default that silently pretends the link said something else.
 */
export function agentFromParam(value: unknown): ClientKind {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_AGENT;
  const known = CLIENT_KINDS.find((k) => k.value === String(raw));
  return known ? known.value : "other";
}

/** How long a fresh key is reported as "waiting" before it is just "not used". */
export const FIRST_USE_WINDOW_MS = 10 * 60_000;

export type FirstUseState = "waiting" | "not_used" | "connected";

/**
 * What to say about a key that may or may not have been used.
 *
 * A key is "waiting" for ten minutes after it is made: somebody who has just
 * pasted the config is looking at this list for the confirmation that it
 * worked, and the list polls while any key is in this state. After that the
 * absence of a first use is a fact, not a countdown.
 */
export function firstUseState(
  key: Pick<ApiKeyView, "createdAt" | "lastUsedAt">,
  now: number,
): FirstUseState {
  if (key.lastUsedAt) return "connected";
  if (key.createdAt && now - key.createdAt < FIRST_USE_WINDOW_MS) return "waiting";
  return "not_used";
}

/** True when the list should keep polling for a first use. */
export function anyWaitingForFirstUse(
  keys: readonly Pick<ApiKeyView, "createdAt" | "lastUsedAt" | "revokedAt">[] | undefined,
  now: number,
): boolean {
  return (keys ?? []).some((k) => !k.revokedAt && firstUseState(k, now) === "waiting");
}

export type TelegramState = "disabled" | "linked" | "code" | "idle";

/**
 * Which of the Telegram card's faces to show.
 *
 * Order matters: a linked chat wins over an outstanding code (the code did its
 * job), and a code that has expired is no code at all — the card goes back to
 * offering one rather than showing a dead code with a deep link that the bot
 * will refuse.
 */
export function telegramState(
  link: MessagingLinkView | null | undefined,
  issued: Pick<MessagingLinkCode, "code" | "expiresAt"> | null | undefined,
  enabled: boolean,
  now: number = Date.now(),
): TelegramState {
  if (!enabled) return "disabled";
  if (link) return "linked";
  if (issued?.code && (!issued.expiresAt || issued.expiresAt > now)) return "code";
  return "idle";
}

export function minutesUntil(ms: number | undefined, now: number = Date.now()): number {
  if (!ms) return 0;
  return Math.max(0, Math.ceil((ms - now) / 60_000));
}

export function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
