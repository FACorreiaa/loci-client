/**
 * Where the OAuth callback page should send the authorization code.
 *
 * Web sign-in opens a popup; that popup's opener receives a postMessage.
 * The iOS app opens the same Google URL inside ASWebAuthenticationSession,
 * which has no opener. Google still lands here (goth's redirect URI is the
 * website). We then bounce to loci:// so the native session can finish.
 *
 * The iOS bug this exists for: without the native branch the page sent
 * users to /auth/signin, ASWebAuthenticationSession never saw loci://,
 * and TestFlight showed "WebAuthenticationSession error 1".
 */

const NATIVE_PROVIDERS = new Set(["google", "apple", "google-calendar", "calendly"]);

export type OAuthCallbackAction =
  | {
      kind: "postMessage";
      payload: {
        type: "oauth-callback";
        code: string | null;
        state: string | null;
        error: string | null;
      };
    }
  | { kind: "nativeRedirect"; url: string }
  | { kind: "signin" };

export function oauthCallbackAction(input: {
  hasOpener: boolean;
  provider: string;
  code: string | null;
  state: string | null;
  error: string | null;
}): OAuthCallbackAction {
  if (input.hasOpener) {
    return {
      kind: "postMessage",
      payload: {
        type: "oauth-callback",
        code: input.code,
        state: input.state,
        error: input.error,
      },
    };
  }

  const provider = input.provider.trim().toLowerCase();
  if (!NATIVE_PROVIDERS.has(provider)) return { kind: "signin" };
  if (!input.code && !input.error) return { kind: "signin" };

  const url = new URL(`loci://oauth2redirect/${provider}`);
  if (input.code) url.searchParams.set("code", input.code);
  if (input.state) url.searchParams.set("state", input.state);
  if (input.error) url.searchParams.set("error", input.error);
  return { kind: "nativeRedirect", url: url.toString() };
}
