// enablePush must call Notification.requestPermission() before it awaits
// anything else, or Safari/Firefox silently and permanently deny the prompt
// because the click's user-activation window has already expired by the
// time it's asked (see the doc comment on enablePush in push-client.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPushConfig, mockRegisterPushDevice } = vi.hoisted(() => ({
  mockGetPushConfig: vi.fn(),
  mockRegisterPushDevice: vi.fn(),
}));

vi.mock("@connectrpc/connect", () => ({
  createClient: () => ({
    getPushConfig: mockGetPushConfig,
    registerPushDevice: mockRegisterPushDevice,
  }),
}));

vi.mock("~/lib/connect-transport", () => ({ transport: {} }));

describe("enablePush", () => {
  let requestPermission: ReturnType<typeof vi.fn>;
  let subscribe: ReturnType<typeof vi.fn>;
  let getSubscription: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockGetPushConfig.mockReset();
    mockRegisterPushDevice.mockReset();

    requestPermission = vi.fn().mockResolvedValue("granted");
    getSubscription = vi.fn().mockResolvedValue(null);
    subscribe = vi.fn().mockResolvedValue({
      endpoint: "https://fcm.googleapis.com/send/abc",
      toJSON: () => ({ keys: { p256dh: "p256dh-value", auth: "auth-value" } }),
    });

    Object.defineProperty(globalThis, "window", {
      value: { PushManager: function PushManager() {} },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }),
        },
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "default", requestPermission },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.window;
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.navigator;
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.Notification;
  });

  it("reaches Notification.requestPermission with nothing awaited ahead of it", async () => {
    // getPushConfig never resolves: if enablePush awaited it before asking for
    // permission (the bug being fixed), requestPermission would never be
    // called and this assertion would fail.
    mockGetPushConfig.mockReturnValue(new Promise(() => {}));

    const { enablePush } = await import("./push-client");
    void enablePush();

    // No await between the call above and here: requestPermission must
    // already have run, synchronously, in the same tick as the "click".
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(mockGetPushConfig).not.toHaveBeenCalled();
  });

  it("does not fetch the VAPID key at all when permission is denied", async () => {
    requestPermission.mockResolvedValue("denied");

    const { enablePush } = await import("./push-client");
    await expect(enablePush()).resolves.toBe("denied");

    expect(mockGetPushConfig).not.toHaveBeenCalled();
    expect(mockRegisterPushDevice).not.toHaveBeenCalled();
  });

  it("subscribes and registers once permission is granted and a key exists", async () => {
    mockGetPushConfig.mockResolvedValue({ vapidPublicKey: "abcd" });
    mockRegisterPushDevice.mockResolvedValue({});

    const { enablePush } = await import("./push-client");
    await expect(enablePush()).resolves.toBe("granted");

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(mockRegisterPushDevice).toHaveBeenCalledTimes(1);
  });

  it("resolves to 'error' instead of rejecting when subscribe/register fails", async () => {
    mockGetPushConfig.mockResolvedValue({ vapidPublicKey: "abcd" });
    subscribe.mockRejectedValue(new Error("boom"));

    const { enablePush } = await import("./push-client");

    // The interactive call site does `void enablePush()` and never sees this
    // promise again, so it must resolve, never reject.
    await expect(enablePush()).resolves.toBe("error");
  });
});
