// enablePush must call Notification.requestPermission() before it awaits
// anything else, or Safari/Firefox silently and permanently deny the prompt
// because the click's user-activation window has already expired by the
// time it's asked (see the doc comment on enablePush in push-client.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPushConfig, mockRegisterPushDevice, mockUnregisterPushDevice } = vi.hoisted(() => ({
  mockGetPushConfig: vi.fn(),
  mockRegisterPushDevice: vi.fn(),
  mockUnregisterPushDevice: vi.fn(),
}));

vi.mock("@connectrpc/connect", () => ({
  createClient: () => ({
    getPushConfig: mockGetPushConfig,
    registerPushDevice: mockRegisterPushDevice,
    unregisterPushDevice: mockUnregisterPushDevice,
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

// Base64url of bytes 1..4, and of a different key.
const KEY_A = "AQIDBA";
const KEY_B = "BQYHCA";

describe("subscribeAndRegister — VAPID key rotation", () => {
  let subscribe: ReturnType<typeof vi.fn>;
  let getSubscription: ReturnType<typeof vi.fn>;
  let unsubscribe: ReturnType<typeof vi.fn>;

  const existing = (key: number[]) => ({
    endpoint: "https://fcm.googleapis.com/send/old",
    options: { applicationServerKey: new Uint8Array(key).buffer },
    unsubscribe,
    toJSON: () => ({ keys: { p256dh: "p", auth: "a" } }),
  });

  beforeEach(() => {
    vi.resetModules();
    mockGetPushConfig.mockReset();
    mockRegisterPushDevice.mockReset().mockResolvedValue({});
    unsubscribe = vi.fn().mockResolvedValue(true);
    subscribe = vi.fn().mockResolvedValue({
      endpoint: "https://fcm.googleapis.com/send/new",
      toJSON: () => ({ keys: { p256dh: "p", auth: "a" } }),
    });
    getSubscription = vi.fn();
    Object.defineProperty(globalThis, "window", {
      value: { PushManager: function PushManager() {} },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {
        serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn().mockResolvedValue("granted") },
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

  it("replaces a subscription made under an old key", async () => {
    mockGetPushConfig.mockResolvedValue({ vapidPublicKey: KEY_B });
    getSubscription.mockResolvedValue(existing([1, 2, 3, 4]));

    const { enablePush } = await import("./push-client");
    await expect(enablePush()).resolves.toBe("granted");

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(mockRegisterPushDevice.mock.calls[0][0].endpoint).toBe(
      "https://fcm.googleapis.com/send/new",
    );
  });

  it("keeps a subscription made under the current key", async () => {
    mockGetPushConfig.mockResolvedValue({ vapidPublicKey: KEY_A });
    getSubscription.mockResolvedValue(existing([1, 2, 3, 4]));

    const { enablePush } = await import("./push-client");
    await expect(enablePush()).resolves.toBe("granted");

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockRegisterPushDevice.mock.calls[0][0].endpoint).toBe(
      "https://fcm.googleapis.com/send/old",
    );
  });
});

describe("unregisterPushDevice (logout)", () => {
  let getRegistration: ReturnType<typeof vi.fn>;
  let unsubscribe: ReturnType<typeof vi.fn>;

  const withSubscription = () => {
    unsubscribe = vi.fn().mockResolvedValue(true);
    getRegistration.mockResolvedValue({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: "https://fcm.googleapis.com/send/me",
          unsubscribe,
        }),
      },
    });
  };

  beforeEach(() => {
    vi.resetModules();
    mockUnregisterPushDevice.mockReset().mockResolvedValue({});
    getRegistration = vi.fn();
    Object.defineProperty(globalThis, "window", {
      value: { PushManager: function PushManager() {} },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { serviceWorker: { getRegistration } },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.window;
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.navigator;
  });

  it("tells the server to forget this endpoint, then unsubscribes", async () => {
    withSubscription();
    const { unregisterPushDevice } = await import("./push-client");
    await unregisterPushDevice();

    expect(mockUnregisterPushDevice).toHaveBeenCalledTimes(1);
    expect(mockUnregisterPushDevice.mock.calls[0][0].endpoint).toBe(
      "https://fcm.googleapis.com/send/me",
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does nothing when this device never subscribed", async () => {
    getRegistration.mockResolvedValue(undefined);
    const { unregisterPushDevice } = await import("./push-client");
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
    expect(mockUnregisterPushDevice).not.toHaveBeenCalled();
  });

  it("still unsubscribes, and does not throw, when the server call fails", async () => {
    withSubscription();
    mockUnregisterPushDevice.mockRejectedValue(new Error("offline"));
    const { unregisterPushDevice } = await import("./push-client");
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("gives up after its timeout instead of holding logout", async () => {
    getRegistration.mockReturnValue(new Promise(() => {}));
    const { unregisterPushDevice } = await import("./push-client");
    await expect(unregisterPushDevice(10)).resolves.toBeUndefined();
  });

  it("is a no-op where push is unsupported (and during SSR)", async () => {
    // @ts-expect-error -- test-only globals, not part of the ambient lib types
    delete globalThis.window;
    const { unregisterPushDevice } = await import("./push-client");
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
    expect(getRegistration).not.toHaveBeenCalled();
  });
});
