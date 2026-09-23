import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Identifies this build to the service worker's precache.
//
// /offline is precached by URL rather than by file (see additionalManifestEntries
// below), so workbox has no file hash to revision it with and would keep the
// copy it fetched on first install across every future deploy.
const buildRevision = Date.now().toString(36);

// Nitro sets the client environment's outDir to `.output/public`; the PWA
// plugin only reads the root `build.outDir`, so point it there explicitly and
// run it for the client environment only (otherwise it also fires for the
// ssr and nitro environments and generates the service worker three times).
const pwa = VitePWA({
  outDir: ".output/public",
  registerType: "autoUpdate",
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
    // The mapbox-gl bundle is ~1.9 MB raw (520 KB gz) and is only
    // reachable from a handful of routes. Precaching it made the service
    // worker download the whole map stack on a first visit to *any* page,
    // including the landing page.
    //
    // Filtered by SIZE rather than by name, because the bundler moves chunks:
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
    // /offline is the page shown when a navigation cannot reach the network.
    // This app is server-rendered and prerenders nothing, so the glob above
    // finds JavaScript chunks and not one HTML file. The page has to be put in
    // the precache by hand: a manifest entry for a URL rather than a file makes
    // the worker FETCH it during install and store the response. The revision
    // is what makes it re-fetch on the next deploy instead of serving a stale
    // copy forever.
    additionalManifestEntries: [{ url: "/offline", revision: buildRevision }],
    // NOT navigateFallback. That option is the SPA app-shell pattern: workbox
    // answers EVERY navigation from the precached document, online or not.
    // Here that document is the rendered /offline page, so once the worker
    // was active every page load got /offline's HTML and then hydrated it as
    // whatever route the URL named — a hydration failure, and the global
    // "Something went wrong" boundary. It showed up wherever Safari had the
    // worker installed, including the iOS app's sign-in sheet, which shares
    // Safari's site data.
    //
    // null rather than omitted: vite-plugin-pwa merges its own default of
    // "index.html" over a missing key. The navigation route below goes to
    // the network and only falls back to /offline when that fails.
    navigateFallback: null,
    // Push + notificationclick handlers (public/push-sw.js). generateSW stays
    // in charge of precaching; this only adds listeners.
    importScripts: ["/push-sw.js"],
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
        handler: "NetworkOnly",
        options: {
          precacheFallback: { fallbackURL: "/offline" },
        },
      },
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
          plugins: [
            {
              // Refuse to store anything that is not JavaScript.
              //
              // A chunk name carries a content hash, so after a deploy the
              // previous build's URL is gone — and the asset host answers a
              // missing asset with the SPA fallback: HTTP 200, `text/html`.
              // That is a cacheable 200 as far as the status filter is
              // concerned, so CacheFirst would write the HTML document into
              // this cache under a `.js` key and then serve it, from disk,
              // for thirty days. Every later visit would fail to parse a
              // module that the network could have supplied correctly.
              cacheWillUpdate: async ({ response }: { response: Response }) => {
                const type = response.headers.get("content-type") ?? "";
                return /javascript|ecmascript/i.test(type) ? response : null;
              },
            },
          ],
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
      { src: "/images/loci.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/loci.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/loci.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  devOptions: {
    enabled: true,
  },
}).map((plugin) => ({
  ...plugin,
  applyToEnvironment: (env: { name: string }) => env.name === "client",
}));

export default defineConfig(({ command, mode }) => ({
  plugins: [
    solidStart({ middleware: "./src/middleware/index.ts" }),
    nitro(),
    tailwindcss(),
    ...pwa,
  ],
  nitro: {
    preset: "cloudflare_module",
    compatibilityDate: "2025-06-12",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  // The production client bundle shipped ~140 console.log calls and every
  // console.error, straight into visitors' devtools. Dropped here, for the
  // browser bundle only: the ssr/nitro environments keep their logs, which is
  // where operators read them. Error reporting goes through captureException
  // (~/lib/analytics), not console, so nothing observable is lost.
  environments:
    command === "build" && mode === "production"
      ? {
          client: {
            build: {
              rolldownOptions: {
                output: {
                  minify: { compress: { dropConsole: true, dropDebugger: true } },
                },
              },
            },
          },
        }
      : undefined,
}));
