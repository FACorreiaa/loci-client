/**
 * Browser notification permission helpers.
 *
 * The preference switches themselves are not here any more: they live on the
 * account via UserService.GetNotificationSettings, so they follow the person
 * between devices and the server can read them. This file used to keep them in
 * localStorage keyed by user id, which did neither.
 *
 * What is left is genuinely per-device — whether *this* browser has been
 * granted permission to show a notification at all. That cannot be stored
 * server-side and has to be asked here.
 */

export type BrowserNotificationPermission = "unsupported" | NotificationPermission;

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
