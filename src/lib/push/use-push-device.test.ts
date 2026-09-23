import { describe, expect, it } from "vitest";
import { derivePushDeviceNotice, PUSH_DEVICE_MESSAGES } from "./use-push-device";

describe("derivePushDeviceNotice", () => {
  it("shows nothing when the setting is off, regardless of device state", () => {
    expect(
      derivePushDeviceNotice({
        isOn: false,
        hasKey: true,
        permission: "default",
        actionMessage: null,
      }),
    ).toBeNull();

    // Even a leftover action message from a previous attempt must not leak
    // through once the switch has been turned off.
    expect(
      derivePushDeviceNotice({
        isOn: false,
        hasKey: true,
        permission: "denied",
        actionMessage: PUSH_DEVICE_MESSAGES.deviceError,
      }),
    ).toBeNull();
  });

  it("prefers a fresh action-attempt message over the state-derived read, while on", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: true,
        permission: "granted",
        actionMessage: PUSH_DEVICE_MESSAGES.deviceError,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.deviceError });
  });

  it("shows the blocked-in-browser line when permission is denied", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: true,
        permission: "denied",
        actionMessage: null,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.blocked });
  });

  it("denied wins over a missing key when both are true", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: false,
        permission: "denied",
        actionMessage: null,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.blocked });
  });

  it("shows the unavailable line when there is no VAPID key and permission is not denied", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: false,
        permission: "default",
        actionMessage: null,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.unavailable });
  });

  it("shows the enable action when a key exists and permission has not been asked yet", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: true,
        permission: "default",
        actionMessage: null,
      }),
    ).toEqual({ kind: "action", text: PUSH_DEVICE_MESSAGES.enableAction });
  });

  it("shows nothing extra once permission is already granted", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: true,
        permission: "granted",
        actionMessage: null,
      }),
    ).toBeNull();
  });

  it("shows the browser-unsupported line when Notification is not available at all", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: true,
        permission: "unsupported",
        actionMessage: null,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.unsupported });
  });

  it("unsupported wins over a missing key when both are true", () => {
    expect(
      derivePushDeviceNotice({
        isOn: true,
        hasKey: false,
        permission: "unsupported",
        actionMessage: null,
      }),
    ).toEqual({ kind: "message", text: PUSH_DEVICE_MESSAGES.unsupported });
  });
});
