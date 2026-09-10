import { ErrorBoundary, Show, type JSX } from "solid-js";
import { MapPin, RefreshCw } from "lucide-solid";
import { captureException } from "~/lib/analytics";
import { logger } from "~/lib/logger";
import type { MapUnavailableReason } from "./useMapLifecycle";

/**
 * What a map panel shows when there is no map to show.
 *
 * Fills the container the map would have filled, so the page keeps its
 * layout; the list beside it still has every place. Copy stays honest without
 * pointing at the cause — a missing token is a build problem, not a user one.
 */
export function MapUnavailable(props: {
  reason?: MapUnavailableReason | null;
  onRetry?: () => void;
  class?: string;
}): JSX.Element {
  return (
    <div
      role="status"
      class={`w-full h-full min-h-[300px] flex items-center justify-center bg-muted/40 rounded-lg ${props.class ?? ""}`}
    >
      <div class="max-w-xs text-center px-6 py-8">
        <div class="mx-auto mb-3 w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center">
          <MapPin class="w-5 h-5" />
        </div>
        <p class="font-semibold text-foreground">Map unavailable right now</p>
        <p class="mt-1 text-sm text-muted-foreground">Your places are still listed beside it.</p>
        <Show when={props.onRetry}>
          <button
            type="button"
            onClick={() => props.onRetry?.()}
            class="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            Try again
          </button>
        </Show>
      </div>
    </div>
  );
}

/**
 * Keeps a map failure inside the map panel.
 *
 * The only other boundary sits above the Router (app.tsx), so anything Mapbox
 * throws during render used to replace the entire page — nav, results, all of
 * it — with "Something went wrong". Wrap the map element, not the route.
 */
export function MapErrorBoundary(props: { children: JSX.Element; class?: string }): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        logger.error("[map] render failed", error);
        captureException(error);
        return <MapUnavailable reason="init_failed" onRetry={reset} class={props.class} />;
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
