import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "url"; // For ES Modules
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SolidStart doesn't ship an index.html template that Vite PWA can patch.
// Provide a minimal html transform so the plugin always sees <head> and <body>
// and can inject the manifest/service worker without warnings.
const ensureHtmlShell = {
  name: "pwa-ensure-html-shell",
  transformIndexHtml(html: string) {
    const hasHead = html.includes("<head>");
    const hasBody = html.includes("<body>");
    if (hasHead && hasBody) return html;
    if (!hasHead && !hasBody) {
      return `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;
    }
    if (!hasHead) return html.replace("<body>", "<head></head><body>");
    return html.replace("</head>", "</head><body></body>");
  },
};

export default defineConfig({
  ssr: true, // ✅ Enabled for better SEO and performance
  server: {
    preset: "cloudflare_module",
    compatibilityDate: "2025-06-12",
  },
  vite: {
    plugins: [
      //cloudflare(),
      ensureHtmlShell,
      tailwindcss() as any,
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          // The mapbox-gl bundle is ~1.9 MB raw (520 KB gz) and is only
          // reachable from a handful of routes. Precaching it made the service
          // worker download the whole map stack on a first visit to *any* page,
          // including the landing page.
          //
          // Filtered by SIZE rather than by name, because Rollup moves chunks:
          // splitting Map.tsx gave Map.tsx and Globe.tsx a shared dependency, so
          // mapbox-gl was rehomed from `Map-*.js` into `useMapLifecycle-*.js`
          // and a name-based ignore silently stopped matching it.
          //
          // manifestTransforms rather than maximumFileSizeToCacheInBytes:
          // the latter works, but vite-plugin-pwa treats "asset excluded by the
          // size limit" as a build-breaking error rather than a warning.
          //
          // Anything dropped here is still cached on first *use* — see the
          // map-chunks runtimeCaching entry below.
          manifestTransforms: [
            (entries) => {
              const LIMIT = 900_000;
              const manifest = entries.filter((e) => (e.size ?? 0) <= LIMIT);
              return { manifest, warnings: [] };
            },
          ],
          globIgnores: ["**/mapbox-gl*"],
          navigateFallback: "/offline",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Cache the map/globe bundles on first use, not up front. Content
              // hashes make these immutable, so CacheFirst is safe.
              urlPattern:
                /\/_build\/assets\/(Map|Globe|TripGlobe|useMapLifecycle|mapbox-gl)[-.][\w-]*\.js$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "map-chunks-cache",
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/api\.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: "Loci - AI Travel Companion",
          short_name: "Loci",
          description:
            "Discover, plan, and explore your next adventure with AI-powered travel recommendations",
          theme_color: "#1a1a1a",
          background_color: "#fafafa",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/images/loci.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/images/loci.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/images/loci.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
  },
});
