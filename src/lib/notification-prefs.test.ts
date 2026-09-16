// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import {
  loadNotificationPrefs,
  notificationPrefsKey,
  saveNotificationPrefs,
} from "./notification-prefs";

describe("notification prefs storage", () => {
  const userId = "user-1";

  afterEach(() => {
    localStorage.removeItem(notificationPrefsKey(userId));
  });

  it("defaults both flags off when nothing is stored", () => {
    expect(loadNotificationPrefs(userId)).toEqual({
      recommendations: false,
      tripReminders: false,
    });
  });

  it("round-trips saved flags", () => {
    saveNotificationPrefs(userId, { recommendations: true, tripReminders: false });
    expect(loadNotificationPrefs(userId)).toEqual({
      recommendations: true,
      tripReminders: false,
    });
  });

  it("ignores garbage in localStorage", () => {
    localStorage.setItem(notificationPrefsKey(userId), "{not json");
    expect(loadNotificationPrefs(userId)).toEqual({
      recommendations: false,
      tripReminders: false,
    });
  });

  it("namespaces by user id", () => {
    saveNotificationPrefs(userId, { recommendations: true, tripReminders: true });
    expect(loadNotificationPrefs("other-user")).toEqual({
      recommendations: false,
      tripReminders: false,
    });
  });
});
