import { logger } from "./logger";

/**
 * Product analytics, kept behind one typed seam.
 *
 * The event names below are the launch plan's funnel. Adding a name here is a
 * deliberate act: an event nobody reads is noise, and a metric with no event is
 * a claim nobody can check.
 */
export type AnalyticsEvent =
  /** A stranger finished sign-up. Metric: stranger signups. */
  | "signup_completed"
  /** A generated itinerary reached its complete event. Metric: finished first itinerary. */
  | "itinerary_finished"
  /** A place was saved to a list or favourites. */
  | "poi_saved"
  /** Someone clicked through to checkout. */
  | "upgrade_clicked";

export type AnalyticsProperties = Record<string, unknown>;

/** The slice of posthog-js this module uses, so tests need no browser. */
export interface AnalyticsClient {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: AnalyticsProperties) => void;
  identify: (id: string, properties?: AnalyticsProperties) => void;
  reset: () => void;
}

export interface AnalyticsConfig {
  key: string;
  host: string;
  client: AnalyticsClient;
}

let active: AnalyticsClient | null = null;

/**
 * Start analytics if a key is configured.
 *
 * Without a key this is a no-op, which is the normal state in development and
 * in any fork: no key, no traffic, no silent failures. Safe to call more than
 * once; only the first call initialises.
 */
export function initAnalytics(config: AnalyticsConfig): void {
  if (active || !config.key) return;
  try {
    config.client.init(config.key, {
      api_host: config.host,
      // The funnel is explicit. Autocapture would bury the four events that
      // matter under every click on the page.
      autocapture: false,
      capture_pageview: true,
      persistence: "localStorage+cookie",
    });
    active = config.client;
  } catch (error) {
    logger.warn("analytics init failed", error);
  }
}

/**
 * Record a funnel event.
 *
 * Events fired before init, including anything during server rendering, are
 * dropped rather than queued: a funnel event with no browser session behind it
 * cannot be attributed to anyone and would only inflate the counts.
 */
export function capture(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (!active) return;
  try {
    active.capture(event, properties);
  } catch (error) {
    // Analytics must never be the reason a user action fails.
    logger.warn("analytics capture failed", event, error);
  }
}

/** Attach subsequent events to a known user. */
export function identify(userId: string, properties?: AnalyticsProperties): void {
  if (!active) return;
  try {
    active.identify(userId, properties);
  } catch (error) {
    logger.warn("analytics identify failed", error);
  }
}

/** Forget the current user. Call on sign-out so sessions do not merge. */
export function resetIdentity(): void {
  if (!active) return;
  try {
    active.reset();
  } catch (error) {
    logger.warn("analytics reset failed", error);
  }
}

/** Test-only: clear module state between cases. */
export function __resetAnalyticsForTest(): void {
  active = null;
}
