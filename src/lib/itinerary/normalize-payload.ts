/* Shapes an itinerary payload into what the page reads, whatever shape it
   arrived in. Extracted from routes/itinerary so it can be tested: it runs on
   every live event and every restore, and getting it wrong empties the page. */

/** Whether a payload has anything a page could render. */
export function hasItineraryContent(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const inner = data.itinerary_response ?? data;
  return Boolean(
    inner?.general_city_data ||
    (Array.isArray(inner?.points_of_interest) && inner.points_of_interest.length > 0) ||
    inner?.itinerary_response ||
    (Array.isArray(data?.hotels) && data.hotels.length > 0) ||
    (Array.isArray(data?.restaurants) && data.restaurants.length > 0) ||
    (Array.isArray(data?.activities) && data.activities.length > 0),
  );
}

/**
 * Whether the payload is the whole answer nested one level down, rather than
 * an ordinary one.
 *
 * The discriminator has to be a field only the OUTER shape carries. It used to
 * include `points_of_interest`, which every AIItineraryResponse has — so the
 * unwrap fired on the ordinary shape, rebuilt the payload from the inner
 * object, and dropped the city data and the itinerary that were only ever at
 * the top level. The page kept its stops and lost its header.
 *
 * That stayed hidden while itineraries were coming back empty: with no places,
 * hasItineraryContent rejected the payload, the caller fell back to the raw
 * object, and the header rendered from that. Fixing the generation is what
 * gave the unwrap something to destroy.
 */
function isDoubleWrapped(data: any): boolean {
  const inner = data?.itinerary_response;
  return Boolean(inner && (inner.general_city_data || inner.itinerary_response));
}

export function normalizeItineraryPayload(data: any): any {
  if (!hasItineraryContent(data)) return null;
  if (!isDoubleWrapped(data)) return data;

  // Spread rather than rebuild, the way the hotels, restaurants and activities
  // routes do it: listing the fields to keep means any field not on the list
  // is silently lost, which is the bug above in its general form.
  const inner = data.itinerary_response;
  return {
    ...data,
    ...inner,
    session_id: inner.session_id || data.session_id,
    hotels: data.hotels ?? inner.hotels,
    restaurants: data.restaurants ?? inner.restaurants,
    activities: data.activities ?? inner.activities,
  };
}
