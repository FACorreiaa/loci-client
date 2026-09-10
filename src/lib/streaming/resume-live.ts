// Reload mid-stream, and pick the stream back up.
//
// The live store is module state, so a hard reload empties it while the
// server is still generating (chat_handler.go keeps going after the client
// disconnects, and buffers every event under the session id). The service
// persisted a small envelope on each event; hand its resume token back and
// the server replays what was missed, then continues live.

import { createStreamingSession, streamingService } from "../streaming-service";
import { isLiveSession, readActiveSession } from "./live-stream-store";
import { readCompletedSession } from "./restore-session";

/**
 * Try to re-attach to `sessionId`. Returns true when a resume was started (or
 * the session is already live), so the caller binds to the live store and
 * skips its fetch paths. False means: nothing to resume — use sessionStorage
 * or the server as before.
 */
export function resumeLiveSession(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  if (isLiveSession(sessionId)) return true;
  // Finished sessions restore from sessionStorage; resuming would re-open a
  // stream the server has already closed.
  if (readCompletedSession(sessionId)) return false;

  const envelope = readActiveSession(sessionId);
  if (!envelope || !envelope.query) return false;

  const session = createStreamingSession(envelope.domain);
  session.sessionId = envelope.sessionId;
  session.city = envelope.city;
  session.query = envelope.query;
  if (envelope.data) session.data = envelope.data;

  streamingService.startStream(
    {
      message: envelope.query,
      sessionId: envelope.sessionId,
      requestId: envelope.requestId,
      resumeToken: envelope.lastEventId || undefined,
      profileId: envelope.profileId,
      cityName: envelope.city || undefined,
    },
    {
      session,
      // Pages read the live store; nothing to route here.
      onProgress: () => {},
      onComplete: () => {},
      onError: () => {},
    },
  );
  return true;
}
