import type { DomainType } from "~/lib/api/types";

/**
 * The one-line summary shown when a stream finishes, and the fallback for a
 * persisted assistant message that cannot be rendered as prose. Lives apart
 * from useChat so the chat formatter (and its tests) can import it without
 * dragging in the chat hook's contexts and JSX.
 */
export const getCompletionMessage = (domain: DomainType, city?: string) => {
  // The space travels with the city so an unknown city leaves no gap before
  // the punctuation ("hotel options." rather than "hotel options .").
  const cityText = city ? ` for ${city}` : "";
  switch (domain) {
    case "accommodation":
      return `Great! I've found some excellent hotel options${cityText}. Click below to view all recommendations and book your stay.`;
    case "dining":
      return `Perfect! I've discovered amazing restaurants${cityText} that match your preferences. Explore the full list to find your next dining experience.`;
    case "activities":
      return `Wonderful! I've curated exciting activities and attractions${cityText}. Check out all the options to plan your perfect day.`;
    default:
      return `Excellent! I've created a personalized itinerary${cityText} based on your preferences. View the complete plan with all the details, maps, and recommendations.`;
  }
};
