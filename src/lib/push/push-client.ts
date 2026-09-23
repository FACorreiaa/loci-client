// Subscribes this browser to web push and tells the server where to send.
// The VAPID public key comes from GetPushConfig at runtime, never from a
// VITE_ variable (the Workers Builds deploy has no env).
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  UserService,
  PushPlatform,
  GetPushConfigRequestSchema,
  RegisterPushDeviceRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/user/user_pb.js";
import { transport } from "~/lib/connect-transport";
import { ensureNotificationPermission, getNotificationPermission } from "~/lib/notification-prefs";
import { logger } from "~/lib/logger";

const userClient = createClient(UserService, transport);
let keyPromise: Promise<string> | null = null;

/** "" when push is off (no VAPID keys configured server-side). Cached per page load. */
export function getVapidKey(): Promise<string> {
  keyPromise ??= userClient
    .getPushConfig(create(GetPushConfigRequestSchema, {}))
    .then((r) => r.vapidPublicKey)
    .catch(() => "");
  return keyPromise;
}

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function toBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function subscribeAndRegister(key: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(key),
    }));
  const json = sub.toJSON();
  await userClient.registerPushDevice(
    create(RegisterPushDeviceRequestSchema, {
      platform: PushPlatform.WEB_PUSH,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    }),
  );
}

/**
 * Ask for notification permission and, if granted, subscribe + register this
 * device.
 *
 * Must be called synchronously from a click handler with NOTHING awaited
 * ahead of `ensureNotificationPermission()` in the call chain. Safari and
 * Firefox drop the "this came from a user gesture" flag the moment control
 * yields back to the event loop — even a single `await` on an
 * already-resolved promise is enough to lose it — and a `Notification.
 * requestPermission()` call made outside a user gesture is silently denied
 * forever, with no way to re-prompt. That is why `pushSupported()` (a plain
 * boolean check, no await) runs first but `getVapidKey()` (a network round
 * trip) runs only after permission is settled, not before.
 */
export async function enablePush(): Promise<
  "granted" | "denied" | "unsupported" | "off" | "error"
> {
  if (!pushSupported()) return "unsupported";
  const permission = await ensureNotificationPermission();
  if (permission !== "granted") return permission === "unsupported" ? "unsupported" : "denied";
  const key = await getVapidKey();
  if (!key) return "off";
  try {
    await subscribeAndRegister(key);
  } catch (err) {
    logger.error("enablePush: subscribe/register failed", err);
    return "error";
  }
  return "granted";
}

/**
 * Whether turning a push-backed switch on should call `enablePush()` right
 * now. Kept pure and separate so the decision is trivial to test: `false`
 * means the caller must not call `enablePush()` — permission is not
 * "default" (nothing to ask, or already answered) or there is no VAPID key
 * (push is not configured server-side, and asking anyway would burn the
 * browser's one-time permission prompt for nothing).
 */
export function shouldEnablePushOnToggle(o: {
  hasKey: boolean;
  permission: "default" | "granted" | "denied" | "unsupported";
}): boolean {
  return o.hasKey && o.permission === "default";
}

/** Already-granted browsers re-subscribe + re-register silently, e.g. on sign-in. */
export async function refreshPushRegistration(): Promise<void> {
  if (!pushSupported() || getNotificationPermission() !== "granted") return;
  const key = await getVapidKey();
  if (key) await subscribeAndRegister(key).catch(() => undefined);
}
