// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { PostHog } from "posthog-node";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

if (import.meta.env.DEV && !posthogKey) {
  throw new Error(
    "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured",
  );
}

if (import.meta.env.DEV && !posthogHost) {
  throw new Error(
    "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured",
  );
}

export const posthog =
  posthogKey && posthogHost
    ? new PostHog(posthogKey, {
        host: posthogHost,
        enableExceptionAutocapture: true,
        metrics: { serviceName: "loci-client" },
      })
    : undefined;

const requestHandler = createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />

          {/* Google Fonts - Preconnect for performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          {/* Async font loading to prevent render blocking */}
          <link
            rel="preload"
            as="style"
            href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,500..700&family=Space+Mono:wght@400;700&display=swap"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,500..700&family=Space+Mono:wght@400;700&display=swap"
            rel="stylesheet"
            media="print"
            onLoad={(e) => {
              (e.currentTarget as HTMLLinkElement).media = "all";
            }}
          />
          <noscript>
            <link
              href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,500..700&family=Space+Mono:wght@400;700&display=swap"
              rel="stylesheet"
            />
          </noscript>

          {/* PWA Meta Tags */}
          <meta name="application-name" content="Loci" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Loci" />
          <meta
            name="description"
            content="Discover, plan, and explore your next adventure with AI-powered travel recommendations"
          />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#1a1a1a" />

          {/* Apple Touch Icons */}
          <link rel="apple-touch-icon" href="/images/loci.png" />
          <link rel="apple-touch-icon" sizes="152x152" href="/images/loci.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/images/loci.png" />
          <link rel="apple-touch-icon" sizes="167x167" href="/images/loci.png" />

          {/* Icons */}
          <link rel="icon" type="image/png" sizes="32x32" href="/images/loci.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/images/loci.png" />
          <link rel="icon" href="/favicon.ico" />

          {/* Manifest */}
          <link rel="manifest" href="/manifest.json" />

          {/* Microsoft */}
          <meta name="msapplication-TileColor" content="#1a1a1a" />
          <meta name="msapplication-TileImage" content="/images/loci.png" />
          <meta name="msapplication-config" content="/browserconfig.xml" />

          {/* Open Graph - Using absolute URLs for better sharing */}
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Loci - AI Travel Companion" />
          <meta
            property="og:description"
            content="Discover, plan, and explore your next adventure with AI-powered travel recommendations"
          />
          <meta property="og:site_name" content="Loci" />
          <meta property="og:url" content="https://loci.app" />
          <meta property="og:image" content="https://loci.app/images/loci.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />

          {/* Twitter - Using absolute URLs */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Loci - AI Travel Companion" />
          <meta
            name="twitter:description"
            content="Discover, plan, and explore your next adventure with AI-powered travel recommendations"
          />
          <meta name="twitter:image" content="https://loci.app/images/loci.png" />
          <meta name="twitter:site" content="@loci" />
          <meta name="twitter:creator" content="@loci" />

          {/* Theme Initialization Script (Blocking) */}
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <script
            innerHTML={`
              (function() {
                try {
                  var localTheme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var useDark = localTheme === 'dark' || (localTheme === 'system' && supportDarkMode) || (!localTheme && supportDarkMode);
                  if (useDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-kb-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-kb-theme', 'light');
                  }

                  var localLanguage = localStorage.getItem('language');
                  if (localLanguage) {
                    document.documentElement.lang = localLanguage;
                  }
                  
                  document.documentElement.setAttribute('data-theme', 'loci');
                  localStorage.setItem('designTheme', 'loci');
                  var themeColor = useDark ? '#14251e' : '#294d3c';
                  var themeMeta = document.querySelector('meta[name="theme-color"]');
                  if (themeMeta) themeMeta.setAttribute('content', themeColor);
                } catch (e) {
                  console.error('Theme init failed', e);
                }
              })();
            `}
          />

          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));

export default async function instrumentedRequestHandler(
  event: Parameters<typeof requestHandler>[0],
) {
  const startedAt = performance.now();
  let outcome = "success";

  try {
    return await requestHandler(event);
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    posthog?.metrics.count("http.server.requests", 1, {
      attributes: { outcome },
    });
    posthog?.metrics.histogram("http.server.duration", performance.now() - startedAt, {
      unit: "ms",
      attributes: { outcome },
    });
    if (posthog) {
      await posthog.metrics.flush().catch(() => {});
    }
  }
}
