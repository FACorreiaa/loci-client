/**
 * Routes that render without the app chrome (nav, footer, floating prompts).
 *
 * Kept as an explicit allowlist rather than a per-route flag because the chrome
 * lives in the Router root in app.tsx, above every page — a page cannot opt
 * itself out from below.
 */
export const CHROMELESS_PREFIXES = ["/globe", "/recap", "/r"] as const;

/**
 * Exact match or a real path segment.
 *
 * The `=== p || startsWith(p + "/")` shape is load-bearing: a bare
 * `startsWith("/globe")` would also strip the chrome from `/globe-beta` and
 * `/globes`, which is the kind of bug that only shows up once someone adds
 * such a route months later.
 */
const underPrefix = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const isChromeless = (pathname: string): boolean =>
  underPrefix(pathname, CHROMELESS_PREFIXES);

/**
 * Routes that declare their own og:image / twitter:image. @solidjs/meta does
 * not merge image tags (a page may list several), so on these the app-wide
 * brand card is left out; otherwise a crawler, which takes the first image,
 * shows the brand card instead of the page's own.
 */
export const OWN_SOCIAL_IMAGE_PREFIXES = ["/r"] as const;

export const hasOwnSocialImage = (pathname: string): boolean =>
  underPrefix(pathname, OWN_SOCIAL_IMAGE_PREFIXES);
