// Shared state for a push-backed notification switch (e.g. "Search
// finished"), used by both NotificationSettings.tsx and
// QuickSettingsModal.tsx.
//
// A push-backed setting is an account-level preference; whether *this*
// browser can actually deliver on it is a separate, per-device question
// (VAPID key configured server-side, and Notification permission on this
// browser). The switch itself must never imply the two are the same thing —
// a server default of "on" for a brand-new user, on a browser that has never
// granted permission, is not a lie so long as the UI says so plainly next to
// it, rendered from current state rather than only right after a click.
import { createSignal, onMount } from "solid-js";
import {
  getNotificationPermission,
  type BrowserNotificationPermission,
} from "~/lib/notification-prefs";
import { enablePush, getVapidKey } from "~/lib/push/push-client";

export const PUSH_DEVICE_MESSAGES = {
  blocked: "Notifications are blocked for this site in your browser settings.",
  unsupported: "This browser can't show notifications.",
  unavailable: "Push isn't available right now.",
  deviceError: "Couldn't turn on notifications on this device.",
  enableAction: "Turn on notifications on this device",
} as const;

export type PushDeviceNotice = { kind: "action" | "message"; text: string } | null;

/**
 * Pure: given the setting's current value and this device's state, which
 * notice (if any) belongs under a push-backed switch. Kept separate from the
 * hook itself so the decision is trivial to test without Solid's reactivity.
 *
 * Order matters:
 * - Off: nothing, regardless of any stale action message or device state.
 * - A message left over from a failed `enableOnThisDevice()` attempt wins
 *   over the state-derived read (it is more specific: an actual attempt just
 *   failed, not just "permission is still unasked").
 * - Denied, then unsupported, both win over a missing key: telling someone
 *   their browser is the blocker is more useful than telling them push isn't
 *   configured, when both happen to be true.
 * - Otherwise, purely a function of permission and whether push is
 *   configured server-side at all.
 */
export function derivePushDeviceNotice(o: {
  isOn: boolean;
  hasKey: boolean;
  permission: BrowserNotificationPermission;
  actionMessage: string | null;
}): PushDeviceNotice {
  if (!o.isOn) return null;
  if (o.actionMessage) return { kind: "message", text: o.actionMessage };
  if (o.permission === "denied") return { kind: "message", text: PUSH_DEVICE_MESSAGES.blocked };
  if (o.permission === "unsupported") {
    return { kind: "message", text: PUSH_DEVICE_MESSAGES.unsupported };
  }
  if (!o.hasKey) return { kind: "message", text: PUSH_DEVICE_MESSAGES.unavailable };
  if (o.permission === "default") {
    return { kind: "action", text: PUSH_DEVICE_MESSAGES.enableAction };
  }
  // Granted: nothing extra to say.
  return null;
}

/**
 * One instance per component that renders a push-backed switch. Prefetches
 * the VAPID key once (so `enableOnThisDevice()` can call `enablePush()` with
 * nothing awaited ahead of it, preserving the click's user-gesture window),
 * and holds the permission + any transient action-attempt message as signals
 * so `deviceNotice()` re-derives live.
 */
export function usePushDeviceState() {
  const [vapidKey, setVapidKey] = createSignal("");
  const [permission, setPermission] = createSignal<BrowserNotificationPermission>(
    getNotificationPermission(),
  );
  const [actionMessage, setActionMessage] = createSignal<string | null>(null);

  onMount(() => {
    void getVapidKey().then(setVapidKey);
  });

  /**
   * Re-reads the browser's current Notification permission into the signal.
   * Exposed so a consumer that shows its own permission-driven UI (e.g. a
   * banner, or disabling other controls) can stay in sync with this same
   * signal instead of keeping a second one that can drift from it.
   */
  const refreshPermission = (): void => {
    setPermission(getNotificationPermission());
  };

  /** Call with the setting's current (persisted or optimistic) value. */
  const deviceNotice = (isOn: boolean): PushDeviceNotice =>
    derivePushDeviceNotice({
      isOn,
      hasKey: Boolean(vapidKey()),
      permission: permission(),
      actionMessage: actionMessage(),
    });

  /**
   * Wired to the "Turn on notifications on this device" action. Must be
   * called directly from a click handler: `enablePush()` runs first, with
   * nothing awaited ahead of it, so Safari/Firefox still count
   * `Notification.requestPermission()` as user-initiated.
   */
  const enableOnThisDevice = (): void => {
    void enablePush().then((result) => {
      refreshPermission();
      setActionMessage(
        result === "error" || result === "unsupported" ? PUSH_DEVICE_MESSAGES.deviceError : null,
      );
    });
  };

  /**
   * Call when the switch itself is flipped, before persisting. Clears a
   * stale action message from a previous attempt, and — when turning on —
   * refreshes permission, since it can have changed in the browser's own
   * site settings since this component mounted.
   */
  const onToggle = (next: boolean): void => {
    setActionMessage(null);
    if (next) refreshPermission();
  };

  return { deviceNotice, enableOnThisDevice, onToggle, permission, refreshPermission };
}
