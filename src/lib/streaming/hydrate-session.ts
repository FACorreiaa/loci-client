// A result page opened with a session id that nothing in this tab knows —
// the notification opened a fresh tab, or the tab was reloaded after the
// run finished. The result is stored server-side; load it instead of
// running (and paying for) the search again.

import { getSessionList, type SessionListSection } from "~/lib/api/llm";
import { saveCompletedSession } from "./completed-sessions";

export async function hydrateSession(
  sessionId: string,
  section: SessionListSection,
  listKey: "activities" | "hotels" | "restaurants" | "points_of_interest",
): Promise<Record<string, unknown> | null> {
  try {
    const { city, pois } = await getSessionList(sessionId, section);
    if (pois.length === 0 && !city) return null;
    const data = { session_id: sessionId, general_city_data: city, [listKey]: pois };
    saveCompletedSession(sessionId, { sessionId, data });
    return data;
  } catch {
    return null;
  }
}
