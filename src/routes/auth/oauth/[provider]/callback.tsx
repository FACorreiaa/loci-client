import { Component, onMount } from "solid-js";
import { useParams } from "@solidjs/router";
import { oauthCallbackAction } from "~/lib/auth/oauth-callback-action";

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
 * This page does not exchange the code itself. It either postMessages the
 * opener (web popup) or redirects to loci:// (iOS ASWebAuthenticationSession).
 * The exchange needs the client secret, which lives on the server.
 */
const OAuthCallback: Component = () => {
  const params = useParams();

  onMount(() => {
    const query = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const oauthIdx = pathParts.indexOf("oauth");
    const providerFromPath = oauthIdx >= 0 ? (pathParts[oauthIdx + 1] ?? "") : "";
    const action = oauthCallbackAction({
      hasOpener: Boolean(window.opener),
      provider: params.provider || providerFromPath,
      code: query.get("code"),
      state: query.get("state"),
      error: query.get("error") || query.get("error_description"),
    });

    if (action.kind === "postMessage" && window.opener) {
      window.opener.postMessage(action.payload, window.location.origin);
      return;
    }
    if (action.kind === "nativeRedirect") {
      window.location.href = action.url;
      return;
    }
    window.location.href = "/auth/signin";
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
