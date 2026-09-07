import { Component, onMount } from "solid-js";

/**
 * Where Google and Apple send the browser back to, after the person has agreed.
 *
 * The path matters and is not ours to choose freely. goth builds each provider
 * with a fixed redirect URI of `OAUTH_CALLBACK_URL + "/<provider>/callback"`,
 * and the provider will only redirect to a URI registered with it — so this
 * route has to sit at exactly that shape, which is why it is
 * /auth/oauth/[provider]/callback rather than the flat /auth/oauth-callback it
 * used to be. With the flat path the popup landed on a URL nothing served and
 * the sign-in never completed.
 *
 * It also has to be on the app's own origin: the code is handed back by
 * postMessage to `window.location.origin`, which the opener checks against its
 * own. A callback hosted on the API domain could not talk to the page that
 * opened it.
 *
 * This page does not exchange the code itself. It passes it to the opener,
 * which calls OAuthCallback over RPC — the exchange needs the client secret,
 * which lives on the server.
 */
const OAuthCallback: Component = () => {
  onMount(() => {
    // Get OAuth response from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // Send message to parent window (opener)
    if (window.opener) {
      window.opener.postMessage(
        {
          type: "oauth-callback",
          code,
          state,
          error: error || errorDescription,
        },
        window.location.origin,
      );
    } else {
      // If no opener (user navigated directly), redirect to login
      window.location.href = "/auth/signin";
    }
  });

  return (
    <div class="min-h-screen flex items-center justify-center bg-background">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p class="text-lg text-foreground">Processing authentication...</p>
        <p class="text-sm text-muted-foreground mt-2">This window will close automatically.</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
