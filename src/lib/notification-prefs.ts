/**
 * Client-side notification preference flags.
 *
 * There is no notification RPC yet. These keys live in localStorage until a
 * proto field exists. Push/email delivery is a later slice.
 *
 * Storage key: `loci.notification-prefs.{userId}`
 */

export const NOTIFICATION_PREFS_STORAGE_PREFIX = "loci.notification-prefs";

export type NotificationPrefs = {
  recommendations: boolean;
  tripReminders: boolean;
};

export type BrowserNotificationPermission = "unsupported" | NotificationPermission;

const DEFAULT_PREFS: NotificationPrefs = {
  recommendations: false,
  tripReminders: false,
};

export function notificationPrefsKey(userId: string): string {
  return `${NOTIFICATION_PREFS_STORAGE_PREFIX}.${userId}`;
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadNotificationPrefs(userId: string): NotificationPrefs {
  const storage = browserStorage();
  if (!storage) return { ...DEFAULT_PREFS };
  try {
    const raw = storage.getItem(notificationPrefsKey(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      recommendations: parsed.recommendations === true,
      tripReminders: parsed.tripReminders === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotificationPrefs(userId: string, prefs: NotificationPrefs): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(notificationPrefsKey(userId), JSON.stringify(prefs));
}

export function getNotificationPermission(): BrowserNotificationPermission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function ensureNotificationPermission(): Promise<BrowserNotificationPermission> {
  const current = getNotificationPermission();
  if (current !== "default") return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return getNotificationPermission();
  }
}
