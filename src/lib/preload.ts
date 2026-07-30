/**
 * Route Preloading Utilities
 *
 * Preloads heavy components when users hover over navigation links
 * to improve perceived navigation speed.
 */

// Preload the MapComponent (2.1MB)
export const preloadMap = () => {
  import("~/components/features/Map/Map");
};

// Preload DetailedItemModal (17KB)
export const preloadDetailedModal = () => {
  import("~/components/DetailedItemModal");
};

// Preload ReviewForm (16KB)
export const preloadReviewForm = () => {
  import("~/components/ReviewForm");
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
