/**
 * Route Preloading Utilities
 *
 * Preloads heavy components when users hover over navigation links
 * to improve perceived navigation speed.
 */

/**
 * Start fetching a chunk, and never let failing to matter.
 *
 * These are speculative: nothing is waiting on the promise, so a rejection
 * had no handler and every one of them reached the console as an unhandled
 * rejection. After a deploy that is guaranteed — a tab holding the previous
 * build asks for hashes the server no longer has — which is how hovering a
 * nav link came to print a module MIME-type error for a component the page
 * was not even rendering. The load that actually needs the chunk goes through
 * lazyChunk, which is where recovering from a stale build belongs.
 */
const warm = (load: () => Promise<unknown>) => {
  void load().catch(() => {});
};

// Preload the MapComponent (2.1MB)
export const preloadMap = () => {
  warm(() => import("~/components/features/Map/Map"));
};

// Preload DetailedItemModal (17KB)
export const preloadDetailedModal = () => {
  warm(() => import("~/components/DetailedItemModal"));
};

// Preload ReviewForm (16KB)
export const preloadReviewForm = () => {
  warm(() => import("~/components/ReviewForm"));
};

// Combined preloaders for specific routes
export const preloadDiscoverRoute = () => {
  preloadMap();
};

export const preloadNearMeRoute = () => {
  preloadMap();
};

export const preloadChatRoute = () => {
  preloadDetailedModal();
};

export const preloadReviewsRoute = () => {
  preloadReviewForm();
};

// Map of routes to their preloaders
export const routePreloaders: Record<string, () => void> = {
  "/discover": preloadDiscoverRoute,
  "/nearme": preloadNearMeRoute,
  // "/near" now just redirects to /nearme, so preloading a map for it would
  // fetch a chunk the redirect never renders.
  "/chat": preloadChatRoute,
  "/reviews": preloadReviewsRoute,
  "/hotels": preloadMap,
  "/restaurants": preloadMap,
  "/activities": preloadMap,
  "/itinerary": preloadMap,
  "/preview/itinerary": preloadMap,
  "/preview/hotels": preloadMap,
  "/preview/restaurants": preloadMap,
  "/preview/activities": preloadMap,
};

/**
 * Get preloader function for a route
 */
export const getPreloader = (href: string): (() => void) | undefined => {
  return routePreloaders[href];
};

/**
 * Preload handler for link hover events
 */
export const handleLinkPreload = (href: string) => {
  const preloader = getPreloader(href);
  if (preloader) {
    preloader();
  }
};
