// Its own module so live-stream-store can use it without importing
// streaming-service, which imports the store.
import type { UnifiedChatResponse } from "../api/types";

/**
 * Whether a payload has anything a page could render. The server's `complete`
 * frame decodes to a zero-valued AiCityResponse (only session_id set), and
 * preferring it over the itinerary that arrived a frame earlier wiped the
 * results at the finish line.
 */
export const responseHasContent = (r: Partial<UnifiedChatResponse> | null | undefined): boolean => {
  if (!r || typeof r !== "object") return false;
  const any = r as any;
  if (any.general_city_data?.city) return true;
  if (Array.isArray(any.gastronomy?.dishes) && any.gastronomy.dishes.length > 0) return true;
  const lists = [
    any.points_of_interest,
    any.itinerary_response?.points_of_interest,
    any.hotels,
    any.restaurants,
    any.activities,
  ];
  return lists.some((l) => Array.isArray(l) && l.length > 0);
};
