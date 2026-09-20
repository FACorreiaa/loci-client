import { describe, expect, it } from "vitest";
import { oauthCallbackAction } from "./oauth-callback-action";

describe("oauthCallbackAction", () => {
  const code = "4/0Aean";
  const state = "goth-session";

  it("hands the code to the web popup when there is an opener", () => {
    expect(
      oauthCallbackAction({
        hasOpener: true,
        provider: "google",
        code,
        state,
        error: null,
      }),
    ).toEqual({
      kind: "postMessage",
      payload: { type: "oauth-callback", code, state, error: null },
    });
  });

  it("still postMessages an OAuth error to the opener, so the popup can close", () => {
    expect(
      oauthCallbackAction({
        hasOpener: true,
        provider: "google",
        code: null,
        state,
        error: "access_denied",
      }),
    ).toEqual({
      kind: "postMessage",
      payload: { type: "oauth-callback", code: null, state, error: "access_denied" },
    });
  });

  it("redirects to the iOS custom scheme when there is no opener and a code", () => {
    const action = oauthCallbackAction({
      hasOpener: false,
      provider: "google",
      code,
      state,
      error: null,
    });
    expect(action.kind).toBe("nativeRedirect");
    if (action.kind !== "nativeRedirect") return;
    const url = new URL(action.url);
    expect(url.protocol).toBe("loci:");
    expect(url.hostname).toBe("oauth2redirect");
    expect(url.pathname).toBe("/google");
    expect(url.searchParams.get("code")).toBe(code);
    expect(url.searchParams.get("state")).toBe(state);
  });

  it("redirects Google Calendar connect the same way as sign-in", () => {
    const action = oauthCallbackAction({
      hasOpener: false,
      provider: "google-calendar",
      code,
      state,
      error: null,
    });
    expect(action.kind).toBe("nativeRedirect");
    if (action.kind !== "nativeRedirect") return;
    expect(new URL(action.url).pathname).toBe("/google-calendar");
  });

  it("redirects Apple the same way", () => {
    const action = oauthCallbackAction({
      hasOpener: false,
      provider: "apple",
      code: "apple-code",
      state: "apple-state",
      error: null,
    });
    expect(action.kind).toBe("nativeRedirect");
    if (action.kind !== "nativeRedirect") return;
    expect(new URL(action.url).pathname).toBe("/apple");
  });

  it("forwards a provider error to the native app instead of dumping on sign-in", () => {
    const action = oauthCallbackAction({
      hasOpener: false,
      provider: "google",
      code: null,
      state,
      error: "access_denied",
    });
    expect(action.kind).toBe("nativeRedirect");
    if (action.kind !== "nativeRedirect") return;
    expect(new URL(action.url).searchParams.get("error")).toBe("access_denied");
  });

  it("falls back to sign-in when a stranger hits the page with no code", () => {
    expect(
      oauthCallbackAction({
        hasOpener: false,
        provider: "google",
        code: null,
        state: null,
        error: null,
      }),
    ).toEqual({ kind: "signin" });
  });

  it("does not mint a loci:// URL for an unknown provider", () => {
    expect(
      oauthCallbackAction({
        hasOpener: false,
        provider: "evil",
        code,
        state,
        error: null,
      }),
    ).toEqual({ kind: "signin" });
  });
});
