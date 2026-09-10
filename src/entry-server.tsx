// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
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
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#FDF5EA" />

          {/* Apple Touch Icons. iOS ignores transparency here and composites onto
              black, so these are the opaque cream-tiled icon, not the favicon. */}
          <link rel="apple-touch-icon" sizes="180x180" href="/images/brand/icon-180.png" />

          {/* Icons. The SVG is what a modern browser picks; the .ico is the
              fallback for the ones that still only look for /favicon.ico. */}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="icon" type="image/png" sizes="32x32" href="/images/brand/icon-32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/images/brand/icon-16.png" />
          <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />

          {/* Manifest */}
          <link rel="manifest" href="/manifest.json" />

          {/* Microsoft */}
          <meta name="msapplication-TileColor" content="#FDF5EA" />
          <meta name="msapplication-TileImage" content="/images/brand/icon-144.png" />
          <meta name="msapplication-config" content="/browserconfig.xml" />

          {/* Open Graph and Twitter live in app.tsx, not here.
              Tags written into this raw document bypass MetaProvider, so a
              route's own <Meta property="og:title"> could not replace them —
              it appended a second one, and every page shipped duplicate
              og:title, og:description and og:url. Crawlers pick between
              duplicates inconsistently, so which title an unfurl showed was a
              coin flip. Declared through @solidjs/meta they are deduped by
              property, and a route overriding one actually overrides it. */}

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
                  var themeColor = useDark ? '#323B42' : '#FDF5EA';
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
