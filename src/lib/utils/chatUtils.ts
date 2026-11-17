/**
 * Chat Utilities
 *
 * Shared utility functions for chat/streaming functionality.
 * Extracted from useChatSession.ts to enable code reuse across hooks and components.
 */

import type { POIDetailedInfo } from "../api/types";

const isHotel = (poi: POIDetailedInfo) => {
  const cat = (poi.category || "").toLowerCase();
  return (
    cat.includes("hotel") ||
    cat.includes("hostel") ||
    cat.includes("lodg") || // lodge/lodging
    cat.includes("resort") ||
    cat.includes("bnb") ||
    cat.includes("inn") ||
    cat.includes("accommodation") ||
    cat.includes("guesthouse") ||
    cat.includes("guest house") ||
    cat.includes("stay") ||
    cat.includes("sleep") ||
    cat.includes("room") ||
    cat.includes("booking") ||
    cat.includes("bookings")
  );
};

const isRestaurant = (poi: POIDetailedInfo) =>
  (poi.category || "").toLowerCase().includes("restaurant") ||
  Boolean((poi as any).cuisine_type || (poi as any).cuisineType);

/**
 * Derive domain-specific lists from mixed POI payloads.
 * Used by Hotels/Restaurants/Activities pages to categorize POIs.
 */
export const deriveDomainLists = (data: any) => {
  const points: POIDetailedInfo[] = [
    ...(data?.points_of_interest || data?.pointsOfInterest || []),
    ...(data?.itinerary_response?.points_of_interest ||
      data?.itineraryResponse?.pointsOfInterest ||
      []),
  ].filter(Boolean);

  const hotels = points.filter(isHotel);
  const restaurants = points.filter(isRestaurant);
  const activities = points.filter((poi) => !isHotel(poi) && !isRestaurant(poi));

  return { hotels, restaurants, activities };
};

const keyFor = (item: any) => {
  const placeholderId = item?.id === "00000000-0000-0000-0000-000000000000";

  // If it's not a placeholder ID and looks like a real UUID, use it
  if (!placeholderId && item?.id) {
    const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      item.id,
    );
    if (isRealUUID && item.id !== "00000000-0000-0000-0000-000000000000") {
      return item.id;
    }
  }

  // Use normalized name as the key for placeholder IDs and synthetic IDs
  const name = item?.name || "";
  const normalizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return normalizedName || item?.llm_interaction_id || Math.random().toString(36).slice(2);
};

/**
 * Merge arrays of items by unique ID.
 * Handles placeholder IDs and uses normalized names as fallback keys.
 */
export const mergeUniqueById = (prev: any[] = [], next: any[] = []) => {
  const map = new Map<string, any>();

  prev.forEach((item) => map.set(keyFor(item), item));
  // Newer data overwrites older data with the same key
  next.forEach((item) => map.set(keyFor(item), item));
  return Array.from(map.values());
};

/**
 * Decode base64 event data from protobuf bytes field.
 */
export const decodeEventData = (data: any): any => {
  if (!data) return null;

  // If it's already an object, return as-is
  if (typeof data === "object") return data;

  // If it's a base64 string, decode it
  if (typeof data === "string") {
    try {
      const decoded = atob(data);
      return JSON.parse(decoded);
    } catch (e) {
      console.warn("Failed to decode base64 event data:", e);
      return null;
    }
  }

  return null;
};

/**
 * Normalize camelCase API responses to snake_case format.
 * Handles both ContinueChat and StreamChat response formats.
 */
export const normalizeItineraryData = (data: any): any => {
  if (!data) return null;

  // Detect if this is a ContinueChat response (has updatedItinerary wrapper)
  const isContinueChatResponse = Boolean(data.updatedItinerary);

  // Handle updatedItinerary wrapper (from ContinueChat response)
  let itinerarySource = data.updatedItinerary || data;

  // Handle case where server wraps everything in itinerary_response (snake_case)
  if (
    itinerarySource.itinerary_response &&
    (itinerarySource.itinerary_response.general_city_data ||
      itinerarySource.itinerary_response.points_of_interest)
  ) {
    itinerarySource = itinerarySource.itinerary_response;
  }

  const normalized: any = {};

  // Normalize general_city_data
  if (itinerarySource.generalCityData) {
    normalized.general_city_data = itinerarySource.generalCityData;
  } else if (itinerarySource.general_city_data) {
    normalized.general_city_data = itinerarySource.general_city_data;
  }

  // Normalize itinerary_response
  if (itinerarySource.itineraryResponse) {
    const ir = itinerarySource.itineraryResponse;
    normalized.itinerary_response = {
      itinerary_name: ir.itineraryName || ir.itinerary_name,
      overall_description: ir.overallDescription || ir.overall_description,
      points_of_interest: ir.pointsOfInterest || ir.points_of_interest || [],
    };
  } else if (itinerarySource.itinerary_response) {
    normalized.itinerary_response = itinerarySource.itinerary_response;
  }

  // For ContinueChat responses: Do NOT add POIs to the general list
  if (!isContinueChatResponse) {
    if (itinerarySource.pointsOfInterest) {
      normalized.points_of_interest = itinerarySource.pointsOfInterest;
    } else if (itinerarySource.points_of_interest) {
      normalized.points_of_interest = itinerarySource.points_of_interest;
    }
  }

  // Copy session info
  normalized.session_id =
    data.sessionId || data.session_id || itinerarySource.sessionId || itinerarySource.session_id;

  // Preserve any other fields from the original data
  if (data.hotels) normalized.hotels = data.hotels;
  if (data.restaurants) normalized.restaurants = data.restaurants;
  if (data.activities) normalized.activities = data.activities;

  return normalized;
};

/**
 * Detect if this is an incremental update vs a full response.
 */
export const isIncrementalUpdate = (data: any, prevData: any): boolean => {
  if (!data) return false;

  const hasItineraryResponse = Boolean(data.itinerary_response);
  const hasExistingData = Boolean(prevData?.itinerary_response || prevData?.general_city_data);

  return hasExistingData && hasItineraryResponse;
};

/**
 * Persist completed session to storage.
 */
export const persistCompletedSession = (sessionIdValue: string | null, data: any) => {
  if (!data) return;

  const resolvedSessionId =
    sessionIdValue ||
    data?.session_id ||
    data?.sessionId ||
    data?.itinerary_response?.session_id ||
    data?.itineraryResponse?.sessionId;

  if (!resolvedSessionId) return;

  const wrapper = {
    sessionId: resolvedSessionId,
    data,
    timestamp: new Date().toISOString(),
  };

  sessionStorage.setItem("completedStreamingSession", JSON.stringify(wrapper));
  // Store a data-only payload for deep links expecting direct domain data
  sessionStorage.setItem(`session_${resolvedSessionId}`, JSON.stringify(data));
};

/**
 * Get a stored session by ID.
 */
export const getStoredSession = (sessionId: string): any => {
  try {
    const stored = sessionStorage.getItem(`session_${sessionId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * Get the current completed streaming session.
 */
export const getCompletedSession = (): {
  sessionId: string;
  data: any;
  timestamp: string;
} | null => {
  try {
    const stored = sessionStorage.getItem("completedStreamingSession");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * Clear all session storage related to chat.
 */
export const clearChatSessionStorage = () => {
  sessionStorage.removeItem("completedStreamingSession");
  sessionStorage.removeItem("currentStreamingSession");
  // Note: Individual session_${id} entries are not cleared
};

/**
 * Format timestamp for display.
 */
export const formatChatTimestamp = (timestamp: string | Date) => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Generate a unique message ID.
 */
export const generateMessageId = (prefix = "msg") => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Progress step messages for different event types.
 */
export const PROGRESS_MESSAGES: Record<string, { message: string; progress: number }> = {
  start: { message: "Starting generation...", progress: 15 },
  city_data: { message: "Loading city information...", progress: 25 },
  general_pois: { message: "Finding points of interest...", progress: 50 },
  itinerary: { message: "Creating your itinerary...", progress: 75 },
  hotels: { message: "Finding accommodations...", progress: 60 },
  restaurants: { message: "Discovering restaurants...", progress: 65 },
  activities: { message: "Finding activities...", progress: 70 },
  nearby: { message: "Finding places near you...", progress: 80 },
  complete: { message: "Complete!", progress: 100 },
};

/**
 * Get progress info for a stream event type.
 */
export const getProgressForEventType = (eventType: string) => {
  return PROGRESS_MESSAGES[eventType] || { message: "Processing...", progress: 50 };
};
