import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createMemo, Show, Suspense } from "solid-js";
import { isChromeless } from "~/lib/chromeless-routes";
import { Meta, MetaProvider } from "@solidjs/meta";
import Nav from "~/components/Nav";
import Footer from "~/components/Footer";
import PWAInstall from "~/components/PWAInstall";
import GlobalErrorBoundary from "~/components/GlobalErrorBoundary";
import PageLoading from "~/components/PageLoading";
import "./app.css";
import { QueryClientProvider } from "@tanstack/solid-query";
// @ts-ignore - Context type
import { AuthProvider } from "~/contexts/AuthContext";
import { ThemeProvider } from "~/contexts/ThemeContext";
import { LanguageProvider } from "~/contexts/LanguageContext";
import { LocaleProvider } from "~/contexts/LocaleContext";
// @ts-ignore - Context type
import { LocationProvider } from "~/contexts/LocationContext";
import queryClient from "~/lib/query-client";
import PageBackground from "./components/PageBackground";
import ProfilePreferencesSync from "~/components/ProfilePreferencesSync";
import ThemeMetaSync from "~/components/ThemeMetaSync";
import UpgradePrompt from "~/components/UpgradePrompt";

const CARD = "https://lociai.fyi/images/brand/og-image.png";
const CARD_ALT =
  "Loci — turn a vibe into a route. Tell it a city and a mood and get a real " +
  "itinerary of real places, mapped and ordered.";

/**
 * The parts of the social card that are the same on every page.
 *
 * Only the invariant ones, deliberately. @solidjs/meta renders every <Meta> the
 * tree declares and resolves duplicates on the client during hydration, using
 * the data-sm cascade attribute — but a crawler reads the server's HTML and
 * never hydrates, so anything declared here that a route also declares ships as
 * a genuine duplicate. That is what was live: two og:title, two og:description
 * and two og:url on every public page, and crawlers pick between duplicates
 * inconsistently, so which one an unfurl showed was a coin flip.
 *
 * Title, description and URL therefore stay with the routes, which have the
 * specific copy for them. A route that declares none still gets a complete
 * card: the image and card type come from here, and crawlers fall back to
 * <title> for the headline.
 */
function SocialDefaults() {
  return (
    <>
      <Meta property="og:type" content="website" />
      <Meta property="og:site_name" content="Loci" />
      <Meta property="og:image" content={CARD} />
      <Meta property="og:image:width" content="1200" />
      <Meta property="og:image:height" content="630" />
      <Meta property="og:image:type" content="image/png" />
      <Meta property="og:image:alt" content={CARD_ALT} />
      {/* summary_large_image is what makes the 1200x630 card render full-width
          rather than as a small square thumbnail beside the text. */}
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:image" content={CARD} />
      <Meta name="twitter:image:alt" content={CARD_ALT} />
      <Meta name="twitter:site" content="@loci" />
      <Meta name="twitter:creator" content="@loci" />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MetaProvider>
        <SocialDefaults />
        <ThemeProvider>
          <ThemeMetaSync />
          <LanguageProvider>
            <GlobalErrorBoundary>
              <Router
                root={(props) => {
                  const location = useLocation();
                  // O(1) and only recomputed on navigation.
                  const bare = createMemo(() => isChromeless(location.pathname));
                  return (
                    <AuthProvider>
                      <ProfilePreferencesSync />
                      <LocaleProvider>
                        <LocationProvider>
                          <div class="min-h-screen flex flex-col relative overflow-hidden transition-colors">
                            {/* Paints the parchment texture the globe replaces. */}
                            <Show when={!bare()}>
                              <PageBackground />
                            </Show>

                            <div class="relative z-10 flex flex-col min-h-screen">
                              <Show when={!bare()}>
                                <Nav />
                              </Show>
                              {/* pb-20 clears the mobile bottom bar, which a
                                chromeless route doesn't render. */}
                              <main
                                class={
                                  bare() ? "relative flex-grow" : "relative flex-grow pb-20 md:pb-0"
                                }
                              >
                                {/* h-dvh, not min-h-screen: an unbounded-height
                                  parent makes the map's ResizeObserver measure
                                  0 or grow without limit. A full-bleed WebGL
                                  canvas needs an exact viewport height. */}
                                <div class={bare() ? "relative h-dvh" : "relative min-h-screen"}>
                                  <Suspense fallback={<PageLoading />}>{props.children}</Suspense>
                                </div>
                              </main>
                              {/* Both float and both are dialog-ish, so they would
                                collide with the globe's drawer focus order. */}
                              <Show when={!bare()}>
                                <Footer />
                                <PWAInstall />
                                <UpgradePrompt />
                              </Show>
                            </div>
                          </div>
                        </LocationProvider>
                      </LocaleProvider>
                    </AuthProvider>
                  );
                }}
              >
                <FileRoutes />
              </Router>
            </GlobalErrorBoundary>
          </LanguageProvider>
        </ThemeProvider>
      </MetaProvider>
    </QueryClientProvider>
  );
}
