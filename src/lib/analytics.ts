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
  | "upgrade_clicked"
  /** A trip draft was successfully saved. */
  | "trip_saved"
  /** A trip export download was successfully created. */
  | "trip_exported"
  /** A review was successfully submitted. */
  | "review_submitted"
  /** A shareable content link was successfully generated. */
  | "share_link_created"
  /** A trip someone shared was copied into the viewer's own trips. */
  | "trip_copied"
  /** Two people became friends (request accepted or invite opened). */
  | "friend_added"
  /** A generated share link was copied to the clipboard. */
  | "share_link_copied"
  /** A field report was submitted. Metric: scout contributions, and how many corroborate. */
  | "place_claim_submitted"
  /** A new place was proposed. Metric: map growth from scouts. */
  | "place_submitted"
  /**
   * A search stream's connection dropped (not a server error). Properties:
   * `code`, `attempt`. Tells whether reconnects are rare or routine.
   */
  | "stream_transport_error"
  /**
   * The client's own stream mapping threw (a bare TypeError out of the
   * StreamChat reader). Property: `message`. A code bug, not a network drop.
   */
  | "stream_mapper_error";

export type AnalyticsProperties = Record<string, unknown>;

/** The slice of posthog-js this module uses, so tests need no browser. */
export interface AnalyticsClient {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: AnalyticsProperties) => void;
  captureException: (error: unknown) => void;
  identify: (id: string, properties?: AnalyticsProperties) => void;
  reset: () => void;
}

export interface AnalyticsConfig {
  key: string;
  host: string;
  tracingHeaders?: string[];
  client: AnalyticsClient;
}

let active: AnalyticsClient | null = null;
let pendingIdentity: { userId: string; properties?: AnalyticsProperties } | null = null;

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
      capture_pageview: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      persistence: "localStorage+cookie",
      ...(config.tracingHeaders?.length ? { tracing_headers: config.tracingHeaders } : {}),
    });
    active = config.client;
    if (pendingIdentity) {
      const { userId, properties } = pendingIdentity;
      pendingIdentity = null;
      identify(userId, properties);
    }
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

/** Send a boundary-caught exception with PostHog's Error Tracking metadata. */
export function captureException(error: unknown): void {
  if (!active) return;
  try {
    active.captureException(error);
  } catch (captureError) {
    logger.warn("analytics exception capture failed", captureError);
  }
}

/** Attach subsequent events to a known user. */
export function identify(userId: string, properties?: AnalyticsProperties): void {
  if (!active) {
    // Auth can restore before the dynamically loaded browser SDK is ready.
    // Retain only the current identity, never a queue of stale sessions.
    pendingIdentity = { userId, properties };
    return;
  }
  try {
    active.identify(userId, properties);
  } catch (error) {
    logger.warn("analytics identify failed", error);
  }
}

/** Forget the current user. Call on sign-out so sessions do not merge. */
export function resetIdentity(): void {
  pendingIdentity = null;
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
  pendingIdentity = null;
}
