import { createMiddleware } from "@solidjs/start/middleware";
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

/**
 * Request timing + outcome metrics. In SolidStart v1 this wrapped the handler
 * returned by `createHandler`; in v2 that handler is an H3 app object, so the
 * same instrumentation lives here as middleware around `next()`.
 */
export default createMiddleware([
  async (_event, next) => {
    const startedAt = performance.now();
    let outcome = "success";

    try {
      return await next();
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
  },
]);
