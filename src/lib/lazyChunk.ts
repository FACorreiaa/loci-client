import { lazy, type Component } from "solid-js";
import { logger } from "~/lib/logger";

/**
 * A code-split component that survives a deploy.
 *
 * Chunk names carry a content hash, so a tab that was open when a new build
 * went out is holding a document that points at files the server no longer
 * has. The asset host answers those with the SPA fallback — HTTP 200 and
 * `text/html` — rather than a 404, so the browser reports it as a module with
 * the wrong MIME type and the import rejects:
 *
 *   Failed to load module script: Expected a JavaScript-or-Wasm module script
 *   but the server responded with a MIME type of "text/html".
 *
 * Nothing is wrong with the code; the document is simply stale. Reloading
 * fetches the current HTML with the current hashes and the import succeeds.
 */

export const RELOAD_KEY = "loci:stale-chunk-reload";

/**
 * How long a reload counts as "just tried".
 *
 * A guard is needed because reloading on a chunk that is genuinely missing
 * would loop forever. A plain once-per-session flag is too strict the other
 * way: a tab left open across two deploys deserves two recoveries. Ten seconds
 * separates "the reload did not fix it" from "this is a different deploy".
 */
const RELOAD_COOLDOWN_MS = 10_000;

function reloadedRecently(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS;
  } catch {
    // Private mode, or storage denied. Without a guard a reload could loop,
    // so treat an unreadable flag as "already tried" and let the error show.
    return true;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* see reloadedRecently */
  }
}

/**
 * True for the shapes browsers use to report a chunk that could not be
 * fetched or parsed as a module. The wording differs per engine, so this
 * matches on the parts that do not: what was being done, not what went wrong.
 */
export function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /dynamically imported module/i.test(message) || // Chrome, Safari
    /error loading dynamically imported module/i.test(message) || // Firefox
    /failed to load module script/i.test(message) || // the MIME-type shape
    /importing a module script failed/i.test(message) // Safari, older
  );
}

/**
 * `lazy()`, plus one reload when the chunk is missing because the build moved.
 *
 * A failure that a reload cannot explain is re-thrown untouched, so the
 * nearest ErrorBoundary still sees a real error rather than a blank refresh.
 */
// The constraint mirrors solid-js `lazy` exactly, props included: narrowing it
// here would reject components this is meant to wrap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyChunk<T extends Component<any>>(loader: () => Promise<{ default: T }>) {
  return lazy<T>(() =>
    loader().catch((error: unknown) => {
      if (!isChunkLoadFailure(error) || typeof window === "undefined") throw error;
      if (reloadedRecently()) {
        logger.error("[chunk] still missing after a reload; not reloading again", error);
        throw error;
      }
      logger.warn("[chunk] missing, most likely a stale tab after a deploy; reloading", error);
      markReloaded();
      window.location.reload();
      // The reload is in flight. Resolving would render a component built from
      // an error, and rejecting would flash a boundary over a page that is
      // about to be replaced, so hand back a promise that never settles.
      return new Promise<{ default: T }>(() => {});
    }),
  );
}
