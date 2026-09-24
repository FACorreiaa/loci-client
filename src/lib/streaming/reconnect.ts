// A dropped connection is not a failed search.
//
// The server keeps generating after a client disconnects, and a request that
// carries `sessionId` + `resumeToken` replays what was missed and then follows
// the live run to its end. Before this, a transport failure (the browser once
// closed three StreamChat requests on one HTTP/2 connection in the same
// millisecond) reached the page as an ordinary `error` event, and a search the
// server finished was announced as "didn't finish".
//
// `streamWithReconnect` is streamChatEvents with that policy applied, so both
// readers — streaming-service (the shared runs) and useChatRPC (page-owned
// runs) — get it by swapping one call. It yields the same events; a transport
// error it can recover from never reaches the caller:
//
//   transport error, session known  → wait (backoff), resume from the last
//                                      event id; up to `backoffMs.length` tries
//   resume says `resume_lost`, or    → ask GetRunStatus every `pollIntervalMs`
//   every try dropped too              for up to `pollTimeoutMs`: DONE becomes
//                                      a `complete` (load_from_session, with
//                                      the server's url), FAILED or still
//                                      RUNNING at the deadline an `error`
//   transport error, no session yet  → passed through: nothing to resume
//   our own abort                    → ends quietly

import { getRunStatuses, type RunInfo } from "../api/llm";
import { capture } from "../analytics";
import { logger } from "../logger";
import {
  streamChatEvents,
  type ChatStreamParams,
  type LociStreamEvent,
  type NavigationInfo,
} from "./chatStream";
import { domainName } from "./domain-name";

type ErrorEvent = Extract<LociStreamEvent, { kind: "error" }>;

/** Timings. Mutable so tests can collapse them; nothing else should. */
export const reconnectPolicyDefaults = Object.freeze({
  /** Wait before each resume attempt; its length is the number of attempts. */
  backoffMs: [1000, 2000, 4000],
  pollIntervalMs: 5000,
  /**
   * The run store's staleness window (runs.StaleAfter, 10 min): a multi-city
   * trip can work for up to nine minutes, and a poll that gave up at five
   * reported a trip that was still being planned as lost. A single city is
   * DONE well before this, and polling stops the moment it is.
   */
  pollTimeoutMs: 10 * 60 * 1000,
});

export const reconnectPolicy: {
  backoffMs: number[];
  pollIntervalMs: number;
  pollTimeoutMs: number;
} = {
  backoffMs: [...reconnectPolicyDefaults.backoffMs],
  pollIntervalMs: reconnectPolicyDefaults.pollIntervalMs,
  pollTimeoutMs: reconnectPolicyDefaults.pollTimeoutMs,
};

/** The server's code for "that run is live on another pod; try again later". */
export const RESUME_LOST = "resume_lost";

export const isTransportError = (e: LociStreamEvent): boolean =>
  e.kind === "error" && e.transport === true;

/** Backoff before resume attempt `attempt` (1-based), or null when out of tries. */
export function reconnectDelay(attempt: number): number | null {
  const d = reconnectPolicy.backoffMs[attempt - 1];
  return d === undefined ? null : d;
}

/**
 * Whether a failed stream should be resumed rather than reported. Only a
 * transport failure, only once the server has named the session, and never
 * after our own abort.
 */
export function shouldResume(e: LociStreamEvent, sessionId: string, aborted: boolean): boolean {
  return !aborted && Boolean(sessionId) && isTransportError(e);
}

/** One line per drop, so the next one can be traced to its cause. No PII. */
export function reportTransportError(e: ErrorEvent, sessionId: string, attempt: number): void {
  logger.warn("stream transport error", {
    code: e.internalCode,
    message: e.detail ?? e.userMessage,
    sessionId,
    attempt,
  });
  capture("stream_transport_error", { code: e.internalCode, attempt });
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done);
  });

export type SettleOutcome =
  | { status: "done"; info: RunInfo }
  | { status: "failed" }
  | { status: "timeout" }
  | { status: "aborted" };

/**
 * Ask the server how a run ended, every `pollIntervalMs` until it is not
 * RUNNING or `pollTimeoutMs` passes. A failed status call (offline for a
 * moment) counts as "still running", not as an answer.
 */
export async function pollRunToSettle(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SettleOutcome> {
  const deadline = Date.now() + reconnectPolicy.pollTimeoutMs;
  for (;;) {
    if (signal?.aborted) return { status: "aborted" };
    try {
      const info = (await getRunStatuses([sessionId])).find((r) => r.sessionId === sessionId);
      if (info?.status === "done") return { status: "done", info };
      if (info?.status === "failed") return { status: "failed" };
    } catch (err) {
      logger.warn("run status poll failed", { sessionId, error: String(err) });
    }
    if (signal?.aborted) return { status: "aborted" };
    if (Date.now() >= deadline) return { status: "timeout" };
    await sleep(reconnectPolicy.pollIntervalMs, signal);
  }
}

/**
 * The navigation a live `complete` would have carried, rebuilt from RunInfo:
 * routeType is the result route ("itinerary", "hotels", …) the server names
 * it by, and the query params match what readers pick out of a live one.
 */
function navigationFromRun(sessionId: string, info: RunInfo): NavigationInfo {
  // getRunStatuses stringifies the proto enum ("2"); a name passes through.
  const domain = /^\d+$/.test(info.domain) ? domainName(Number(info.domain)) : info.domain;
  const routeType = new URL(info.url, "https://x").pathname.split("/").filter(Boolean)[0] ?? "";
  return {
    url: info.url,
    routeType,
    queryParams: {
      sessionId,
      ...(domain ? { domain } : {}),
      ...(info.cityName ? { cityName: info.cityName } : {}),
    },
  };
}

/** What a settled poll means to a stream reader: its terminal event. */
export function settleEvent(sessionId: string, outcome: SettleOutcome): LociStreamEvent | null {
  switch (outcome.status) {
    case "done":
      return {
        kind: "complete",
        sessionId,
        // Nothing came down the stream: pages load the result from the session.
        loadFromSession: true,
        ...(outcome.info.url ? { navigation: navigationFromRun(sessionId, outcome.info) } : {}),
      };
    case "failed":
      return {
        kind: "error",
        userMessage: "This search didn't finish. Try again.",
        internalCode: "run_failed",
        retryable: true,
      };
    case "timeout":
      return {
        kind: "error",
        userMessage: "We lost touch with this search. Try again in a moment.",
        internalCode: "resume_timeout",
        retryable: true,
      };
    case "aborted":
      return null;
  }
}

/**
 * streamChatEvents, resumed across dropped connections. See the file header
 * for the policy. Callers consume it exactly as they would streamChatEvents.
 */
export async function* streamWithReconnect(
  params: ChatStreamParams,
  signal?: AbortSignal,
): AsyncGenerator<LociStreamEvent> {
  let sessionId = params.sessionId ?? "";
  let lastEventId = params.resumeToken ?? "";
  let attempt = 0;
  let request = params;
  // Across reopenings too: a replay must never double-emit.
  const seen = new Set<string>();

  for (;;) {
    let failure: ErrorEvent | null = null;
    let lost = false;
    let progressed = false;

    for await (const ev of streamChatEvents(request, signal)) {
      if (signal?.aborted) return;
      if (ev.eventId) {
        if (seen.has(ev.eventId)) continue;
        seen.add(ev.eventId);
        lastEventId = ev.eventId;
      }
      if (ev.kind === "error" && ev.transport) {
        failure = ev;
        break;
      }
      // The run is live on another pod: the stream cannot follow it, the
      // status endpoint can.
      if (ev.kind === "error" && ev.internalCode === RESUME_LOST && sessionId) {
        lost = true;
        break;
      }
      if (ev.kind === "start") {
        // A resume re-announcing the run it is already bound to.
        if (attempt > 0 && ev.sessionId === sessionId) continue;
        if (ev.sessionId) sessionId = ev.sessionId;
      }
      progressed = true;
      yield ev;
    }

    if (signal?.aborted) return;
    // Ended on its own terminal event (or cleanly): done.
    if (!failure && !lost) return;

    if (failure) {
      if (progressed) attempt = 0; // a resume that delivered was a success
      reportTransportError(failure, sessionId, attempt + 1);
      if (!shouldResume(failure, sessionId, signal?.aborted ?? false)) {
        yield failure;
        return;
      }
      const delay = reconnectDelay(attempt + 1);
      // No event id means no resume point: a request with the session id and
      // no token would start the search over, so ask how it ended instead.
      if (delay !== null && lastEventId) {
        attempt++;
        await sleep(delay, signal);
        if (signal?.aborted) return;
        request = { ...params, sessionId, resumeToken: lastEventId };
        continue;
      }
    }

    const settled = settleEvent(sessionId, await pollRunToSettle(sessionId, signal));
    if (settled && !signal?.aborted) yield settled;
    return;
  }
}
