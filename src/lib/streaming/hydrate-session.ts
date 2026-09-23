// A result page opened with a session id that nothing in this tab knows —
// the notification opened a fresh tab, or the tab was reloaded after the
// run finished. The result is stored server-side; load it instead of
// running (and paying for) the search again.

import { getChatSession, getSessionList, type SessionListSection } from "~/lib/api/llm";
import type { DomainType, UnifiedChatResponse } from "~/lib/api/types";
import { saveCompletedSession } from "./completed-sessions";
import { responseHasContent } from "./response-content";

type ListKey = "activities" | "hotels" | "restaurants" | "points_of_interest";

/** Where a finished session's list lives on the server, and the key the pages read it under. */
export function sectionFor(domain: DomainType): [SessionListSection, ListKey] {
  switch (domain) {
    case "accommodation":
      return ["hotels", "hotels"];
    case "dining":
      return ["restaurants", "restaurants"];
    case "activities":
      return ["activities", "activities"];
    default:
      return ["general", "points_of_interest"];
  }
}

/**
 * The stored result of a run that finished off-stream (a resume answered
 * with load_from_session, or settled by GetRunStatus). An itinerary comes
 * from GetChatSession; a list domain from its GetSessionPOIs section. Null
 * when the server has nothing to show, or the fetch failed.
 */
export async function hydrateFinishedSession(
  sessionId: string,
  domain: DomainType,
): Promise<Partial<UnifiedChatResponse> | null> {
  if (domain === "itinerary" || domain === "general") {
    try {
      const itinerary = await getChatSession(sessionId);
      return itinerary && responseHasContent(itinerary) ? itinerary : null;
    } catch {
      return null;
    }
  }
  return (await hydrateSession(
    sessionId,
    ...sectionFor(domain),
  )) as Partial<UnifiedChatResponse> | null;
}

export async function hydrateSession(
  sessionId: string,
  section: SessionListSection,
  listKey: ListKey,
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
