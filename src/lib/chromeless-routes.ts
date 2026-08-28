/**
 * Routes that render without the app chrome (nav, footer, floating prompts).
 *
 * Kept as an explicit allowlist rather than a per-route flag because the chrome
 * lives in the Router root in app.tsx, above every page — a page cannot opt
 * itself out from below.
 */
export const CHROMELESS_PREFIXES = ["/globe"] as const;

/**
 * Exact match or a real path segment.
 *
 * The `=== p || startsWith(p + "/")` shape is load-bearing: a bare
 * `startsWith("/globe")` would also strip the chrome from `/globe-beta` and
 * `/globes`, which is the kind of bug that only shows up once someone adds
 * such a route months later.
 */
export const isChromeless = (pathname: string): boolean =>
  CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
