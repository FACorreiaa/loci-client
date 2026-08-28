import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createMemo, Show, Suspense } from "solid-js";
import { isChromeless } from "~/lib/chromeless-routes";
import { MetaProvider } from "@solidjs/meta";
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
// @ts-ignore - Context type
import { LocationProvider } from "~/contexts/LocationContext";
import queryClient from "~/lib/query-client";
import PageBackground from "./components/PageBackground";
import ProfilePreferencesSync from "~/components/ProfilePreferencesSync";
import ThemeMetaSync from "~/components/ThemeMetaSync";
import UpgradePrompt from "~/components/UpgradePrompt";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MetaProvider>
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
