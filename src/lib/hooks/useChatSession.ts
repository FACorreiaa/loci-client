import { createSignal, batch } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "~/contexts/AuthContext";
import { streamChatEvents, type LociStreamEvent } from "~/lib/streaming/chatStream";
import { parseStreamError } from "~/lib/errors";
import {
  setStreamingSession,
  updateStreamingData,
  markStreamingComplete,
} from "~/lib/streaming-state";

import {
  deriveDomainLists as deriveDomainListsUtil,
  mergeUniqueById as mergeUniqueByIdUtil,
  decodeEventData as decodeEventDataUtil,
  normalizeItineraryData as normalizeItineraryDataUtil,
  isIncrementalUpdate as isIncrementalUpdateUtil,
  persistCompletedSession as persistCompletedSessionUtil,
} from "~/lib/chat-stream";

// Adapts a normalized reader event to the legacy { Type, Data, ... } shape the
// existing case bodies below read. This is the one bridge left after moving off
// the SSE shim — it keeps the intricate state logic byte-identical while the
// stream source is now the canonical typed reader (no text round-trip).
type LegacyStreamEvent = {
  Type: string;
  Data?: any;
  Message?: string;
  Navigation?: any;
  Error?: string;
  SessionId?: string;
};

function toLegacyEvent(ev: LociStreamEvent): LegacyStreamEvent {
  switch (ev.kind) {
    case "start":
      return {
        Type: "start",
        Data: { session_id: ev.sessionId, domain: ev.domain, city: ev.city },
      };
    case "token":
    case "partial":
      return { Type: "chunk", Data: { chunk: ev.text } };
    case "progress":
      return { Type: "progress", Data: ev.stage };
    case "city_data":
      return { Type: "itinerary", Data: { general_city_data: ev.city } };
    case "general_pois":
      return {
        Type: "itinerary",
        Data: { general_city_data: ev.city, points_of_interest: ev.pois },
      };
    case "hotels":
      return { Type: "hotels", Data: ev.pois, SessionId: ev.sessionId };
    case "restaurants":
      return { Type: "restaurants", Data: ev.pois, SessionId: ev.sessionId };
    case "activities":
      return { Type: "activities", Data: ev.pois, SessionId: ev.sessionId };
    case "itinerary":
      return { Type: "itinerary", Data: ev.cityResponse };
    case "complete":
      return { Type: "complete", Navigation: ev.navigation, SessionId: ev.sessionId };
    case "error":
      return { Type: "error", Error: ev.userMessage };
  }
}

export interface ChatMessage {
  type: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
}

export interface UseChatSessionOptions {
  sessionIdPrefix?: string;
  initialSessionId?: string; // Initial session ID from URL params to continue existing session
  onStreamingComplete?: (data: any) => void;
  onError?: (error: Error) => void;
  onUpdateStart?: () => void;
  onUpdateComplete?: () => void;
  getStreamingData?: () => any;
  setStreamingData?: (data: any) => void;
  mapDisabled?: boolean;
  setMapDisabled?: (disabled: boolean) => void;
  poisUpdateTrigger?: () => void;
  setPoisUpdateTrigger?: (fn: (prev: number) => number) => void;
  enableNavigation?: boolean; // New option to enable URL navigation
  onNavigationData?: (navigation: any) => void; // Callback for navigation data
}

// Re-export utilities for backward compatibility with existing imports
export const deriveDomainLists = deriveDomainListsUtil;
const mergeUniqueById = mergeUniqueByIdUtil;
const decodeEventData = decodeEventDataUtil;
const normalizeItineraryData = normalizeItineraryDataUtil;
const isIncrementalUpdate = isIncrementalUpdateUtil;
const persistCompletedSession = persistCompletedSessionUtil;

export function useChatSession(options: UseChatSessionOptions = {}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [showChat, setShowChat] = createSignal(false);
  const [chatMessage, setChatMessage] = createSignal("");
  const [chatHistory, setChatHistory] = createSignal<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  // Initialize sessionId from options if provided (e.g., from URL params)
  const [sessionId, setSessionId] = createSignal<string | null>(options.initialSessionId || null);
  const [isUpdatingItinerary, setIsUpdatingItinerary] = createSignal(false);

  // Log initial session ID for debugging
  if (options.initialSessionId) {
    console.log("🔗 useChatSession initialized with session ID:", options.initialSessionId);
  }

  // Chunk buffer for progressive JSON parsing (similar to StreamingChatService)
  const chunkBuffer: {
    general_pois: string;
    itinerary: string;
    city_data: string;
    hotels: string;
    restaurants: string;
    activities: string;
  } = {
    general_pois: "",
    itinerary: "",
    city_data: "",
    hotels: "",
    restaurants: "",
    activities: "",
  };

  // Helper function to parse buffered chunk data
  const tryParseBufferedData = (part: string): any | null => {
    let buffer = chunkBuffer[part as keyof typeof chunkBuffer];

    // Remove markdown code blocks
    buffer = buffer.replace(/```json\n?/g, "").replace(/```\n?/g, "");

    // Try to find complete JSON objects
    let braceCount = 0;
    let jsonStart = -1;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === "{") {
        if (braceCount === 0) {
          jsonStart = i;
        }
        braceCount++;
      } else if (buffer[i] === "}") {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          // Found complete JSON object
          const jsonStr = buffer.substring(jsonStart, i + 1);
          try {
            const jsonData = JSON.parse(jsonStr);
            console.log(`=== PARSED JSON FOR ${part.toUpperCase()} ===`);
            console.log("JSON data:", jsonData);

            // Remove processed data from buffer
            chunkBuffer[part as keyof typeof chunkBuffer] = buffer.substring(i + 1);
            return jsonData;
          } catch (_parseError) {
            // JSON not complete yet, continue accumulating
            console.log(`Partial JSON for ${part}, continuing...`);
          }
        }
      }
    }

    return null;
  };

  // Function to start a new session when the old one is not found
  const startNewSession = async (userMessage: string) => {
    try {
      console.log("Starting new chat session...");

      const streaming = options.getStreamingData?.();
      const cityName =
        streaming?.general_city_data?.city ||
        streaming?.activities?.[0]?.city ||
        streaming?.restaurants?.[0]?.city ||
        "Unknown";

      // Get user ID from auth context
      const userId = auth.user()?.id;
      if (!userId) {
        throw new Error("User not authenticated - cannot start new session");
      }

      const newSessionPayload = {
        message: `Continue planning for ${cityName}. ${userMessage}`,
        user_location: null,
      };

      let newSessionMessage = "";

      // Canonical typed reader; adapt each event to the legacy shape below.
      for await (const ev of streamChatEvents({
        message: newSessionPayload.message,
        profileId: userId,
        cityName,
      })) {
        const eventData: any = toLegacyEvent(ev);
        switch (eventData.Type) {
          case "start": {
            const startData = eventData.Data || eventData.data;
            if (startData && startData.session_id) {
              console.log("New session ID:", startData.session_id);
              setSessionId(startData.session_id);

              // Update session storage with consistent data structure
              const storedSession = sessionStorage.getItem("completedStreamingSession");
              if (storedSession) {
                try {
                  const session = JSON.parse(storedSession);
                  session.sessionId = startData.session_id;
                  // Also store in data.session_id for consistency
                  if (session.data) {
                    session.data.session_id = startData.session_id;
                    session.data.sessionId = startData.session_id;
                  }
                  sessionStorage.setItem("completedStreamingSession", JSON.stringify(session));
                  console.log(
                    "✅ Updated session storage in new session with ID:",
                    startData.session_id,
                  );
                } catch (error) {
                  console.error("Error updating session storage in new session:", error);
                }
              } else {
                // Create a new session storage entry if none exists
                const newSession = {
                  sessionId: startData.session_id,
                  data: {
                    session_id: startData.session_id,
                    sessionId: startData.session_id,
                  },
                };
                sessionStorage.setItem("completedStreamingSession", JSON.stringify(newSession));
                console.log(
                  "✅ Created new session storage in new session with ID:",
                  startData.session_id,
                );
              }
            }
            break;
          }

          case "itinerary": {
            const itineraryData2 = decodeEventData(eventData.Data || eventData.data);
            const message2 = eventData.Message || eventData.message;
            const derivedLists2 = deriveDomainLists(itineraryData2);

            if (itineraryData2) {
              if (options.setStreamingData) {
                options.setStreamingData((prev: any) => {
                  const hasAuthoritativeList = true;
                  const mergedHotels = hasAuthoritativeList
                    ? derivedLists2.hotels
                    : mergeUniqueById(prev?.hotels, itineraryData2.hotels || derivedLists2.hotels);

                  const mergedRestaurants = hasAuthoritativeList
                    ? derivedLists2.restaurants
                    : mergeUniqueById(
                        prev?.restaurants,
                        itineraryData2.restaurants || derivedLists2.restaurants,
                      );

                  const mergedActivities = hasAuthoritativeList
                    ? derivedLists2.activities
                    : mergeUniqueById(
                        prev?.activities,
                        itineraryData2.activities || derivedLists2.activities,
                      );

                  return {
                    ...prev,
                    ...(itineraryData2.general_city_data && {
                      general_city_data: itineraryData2.general_city_data,
                    }),
                    ...(itineraryData2.points_of_interest && {
                      points_of_interest: itineraryData2.points_of_interest,
                    }),
                    ...(itineraryData2.itinerary_response && {
                      itinerary_response: itineraryData2.itinerary_response,
                    }),
                    ...(mergedActivities.length && {
                      activities: mergedActivities,
                    }),
                    ...(mergedRestaurants.length && {
                      restaurants: mergedRestaurants,
                    }),
                    ...(mergedHotels.length && {
                      hotels: mergedHotels,
                    }),
                  };
                });
              }

              const mergedHotels = mergeUniqueById(
                (options.getStreamingData?.() as any)?.hotels,
                itineraryData2.hotels || derivedLists2.hotels,
              );
              const mergedRestaurants = mergeUniqueById(
                (options.getStreamingData?.() as any)?.restaurants,
                itineraryData2.restaurants || derivedLists2.restaurants,
              );
              const mergedActivities = mergeUniqueById(
                (options.getStreamingData?.() as any)?.activities,
                itineraryData2.activities || derivedLists2.activities,
              );

              const mergedDataForPersistence = {
                ...options.getStreamingData?.(),
                ...itineraryData2,
                hotels: mergedHotels,
                restaurants: mergedRestaurants,
                activities: mergedActivities,
              };

              persistCompletedSession(
                sessionId() || itineraryData2.session_id,
                mergedDataForPersistence,
              );

              // Persist derived lists for navigation/storage consistency
              updateStreamingData(mergedDataForPersistence);

              if (message2) {
                newSessionMessage += message2 + " ";
              }
            }
            break;
          }

          case "complete": {
            const completeMessage = eventData.Message || eventData.message;
            if (completeMessage && completeMessage !== "Turn completed.") {
              newSessionMessage += completeMessage;
            }

            // Handle navigation data if present for new session
            const navigationData = eventData.Navigation || eventData.navigation;
            if (navigationData && options.enableNavigation) {
              console.log("Received navigation data in new session:", navigationData);

              if (options.onNavigationData) {
                options.onNavigationData(navigationData);
              }

              // Navigate to the specified URL if present
              if (navigationData.url || navigationData.URL) {
                const targetUrl = navigationData.url || navigationData.URL;
                console.log("Navigating to (new session):", targetUrl);
                navigate(targetUrl);
              }
            }
            break;
          }

          case "error":
            throw new Error(eventData.Error || eventData.error || "New session error");
        }
      }

      // Add response from new session to chat
      if (newSessionMessage.trim()) {
        setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `New session started. ${newSessionMessage.trim()}`,
            timestamp: new Date(),
          },
        ]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: "New session started successfully.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error: any) {
      console.error("Error starting new session:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          type: "error",
          content: `Failed to start new session: ${error.message || "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage().trim() || isLoading()) return;

    const currentSessionId = sessionId();
    console.log("🔍 sendChatMessage - Current session ID:", currentSessionId);
    console.log(
      "🔍 sendChatMessage - Session storage:",
      sessionStorage.getItem("completedStreamingSession"),
    );
    console.log("🔍 sendChatMessage - Streaming data present:", !!options.getStreamingData?.());

    // If no session ID in signal, try to extract from session storage as fallback
    let workingSessionId = currentSessionId;
    if (!workingSessionId) {
      console.log("No session ID in signal, trying session storage fallback...");
      const storedSession = sessionStorage.getItem("completedStreamingSession");
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          workingSessionId =
            session.sessionId || session.data?.session_id || session.data?.sessionId;
          if (workingSessionId) {
            console.log("✅ Found session ID in storage fallback:", workingSessionId);
            setSessionId(workingSessionId); // Update the signal
          }
        } catch (error) {
          console.error("Error parsing stored session for fallback:", error);
        }
      }
    }

    if (!workingSessionId) {
      console.log("No session ID found after fallback attempts, starting new session...");

      // Check if we have streaming data to work with
      const streaming = options.getStreamingData?.();
      if (
        streaming &&
        (streaming.general_city_data?.city || streaming.activities || streaming.restaurants)
      ) {
        console.log("Have streaming data, starting new session for chat...");

        // Add a message showing we're starting a new session
        setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: "Starting a new session to continue your conversation...",
            timestamp: new Date(),
          },
        ]);

        // Start new session with the user message
        const userMessage = chatMessage().trim();
        await startNewSession(userMessage);
        return;
      } else {
        // No streaming data available
        setChatHistory((prev) => [
          ...prev,
          {
            type: "error",
            content:
              "No active session found. Please refresh the page to start a new conversation.",
            timestamp: new Date(),
          },
        ]);
        return;
      }
    }

    const userMessage = chatMessage().trim();
    setChatMessage("");
    setIsLoading(true);
    setIsUpdatingItinerary(false);

    // Add user message to chat history
    setChatHistory((prev) => [
      ...prev,
      { type: "user", content: userMessage, timestamp: new Date() },
    ]);

    try {
      const streamingData = options.getStreamingData?.();

      // Extract city name from various possible sources in the streaming data
      const cityName =
        streamingData?.general_city_data?.city ||
        streamingData?.activities?.[0]?.city ||
        streamingData?.restaurants?.[0]?.city ||
        streamingData?.hotels?.[0]?.city ||
        streamingData?.points_of_interest?.[0]?.city;

      console.log("🏙️ Extracted city name for continue chat:", cityName);

      if (!cityName) {
        console.warn("⚠️ No city name found in streaming data. API may require it.");
      }

      let assistantMessage = "";
      let needsNewSession = false;

      // Canonical typed reader keyed by sessionId (real continuation); adapt each
      // event to the legacy shape the case bodies read.
      for await (const ev of streamChatEvents({
        message: userMessage,
        sessionId: workingSessionId,
        cityName,
      })) {
        const eventData: any = toLegacyEvent(ev);
        switch (eventData.Type) {
          case "start": {
            // Extract session ID from start event when a new session is created
            // Note: data field is base64 encoded from protobuf bytes
            const startData = decodeEventData(eventData.Data || eventData.data);
            if (startData && startData.session_id) {
              console.log("🚀 New session started with ID:", startData.session_id);
              setSessionId(startData.session_id);

              // Reset chunk buffer for new session
              chunkBuffer.general_pois = "";
              chunkBuffer.itinerary = "";
              chunkBuffer.city_data = "";
              chunkBuffer.hotels = "";
              chunkBuffer.restaurants = "";
              chunkBuffer.activities = "";

              // Initialize streaming session for progressive loading
              const domain = startData.domain || "general";
              const city = startData.city || cityName;

              setStreamingSession({
                sessionId: startData.session_id,
                domain: domain,
                city: city,
                isComplete: false,
                data: {
                  session_id: startData.session_id,
                  sessionId: startData.session_id,
                  domain: domain,
                },
              });

              // Early navigation if enabled and we have a domain
              if (options.enableNavigation && domain !== "general") {
                const domainRoutes: Record<string, string> = {
                  accommodation: "/hotels",
                  dining: "/restaurants",
                  itinerary: "/itinerary",
                };

                const targetRoute = domainRoutes[domain];
                if (targetRoute) {
                  const navUrl = `${targetRoute}?sessionId=${startData.session_id}&cityName=${encodeURIComponent(city || "Unknown")}&domain=${domain}&streaming=true`;
                  console.log("🧭 Early navigation to:", navUrl);
                  navigate(navUrl);
                }
              }

              // Also update legacy session storage for backward compatibility
              const storedSession = sessionStorage.getItem("completedStreamingSession");
              if (storedSession) {
                try {
                  const session = JSON.parse(storedSession);
                  session.sessionId = startData.session_id;
                  if (session.data) {
                    session.data.session_id = startData.session_id;
                    session.data.sessionId = startData.session_id;
                  }
                  sessionStorage.setItem("completedStreamingSession", JSON.stringify(session));
                } catch (error) {
                  console.error("Error updating session storage with new session ID:", error);
                }
              } else {
                const newSession = {
                  sessionId: startData.session_id,
                  data: {
                    session_id: startData.session_id,
                    sessionId: startData.session_id,
                  },
                };
                sessionStorage.setItem("completedStreamingSession", JSON.stringify(newSession));
              }
            }
            break;
          }

          case "chunk": {
            // Handle streaming chunks - buffer and parse JSON progressively
            // Note: data field is base64 encoded from protobuf bytes
            const chunkData = decodeEventData(eventData.Data || eventData.data);
            if (!chunkData) break;

            const { chunk, part } = chunkData;
            console.log(`📦 Received chunk for ${part}:`, chunk?.substring(0, 100) + "...");

            // Accumulate chunks in buffer
            if (
              part &&
              (part === "general_pois" ||
                part === "itinerary" ||
                part === "city_data" ||
                part === "hotels" ||
                part === "restaurants" ||
                part === "activities")
            ) {
              chunkBuffer[part as keyof typeof chunkBuffer] += chunk;

              // Try to parse complete JSON from buffer
              const parsedData = tryParseBufferedData(part);
              if (parsedData) {
                console.log(`✅ Successfully parsed complete JSON for ${part}`);

                // Process the parsed data based on part type
                if (options.setStreamingData) {
                  batch(() => {
                    switch (part) {
                      case "city_data":
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          general_city_data: parsedData,
                        }));
                        updateStreamingData({ general_city_data: parsedData });
                        break;

                      case "general_pois": {
                        const pois = parsedData.points_of_interest || [];
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          points_of_interest: pois,
                        }));
                        updateStreamingData({ points_of_interest: pois });
                        break;
                      }

                      case "itinerary":
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          itinerary_response: parsedData,
                        }));
                        updateStreamingData({ itinerary_response: parsedData });

                        // Trigger POI update for the map
                        if (options.setPoisUpdateTrigger) {
                          options.setPoisUpdateTrigger((prev) => prev + 1);
                        }
                        break;

                      case "hotels": {
                        const hotels = parsedData.hotels || [];
                        const mergedHotels = mergeUniqueById(
                          options.getStreamingData?.()?.hotels,
                          hotels,
                        );
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          hotels: mergedHotels,
                        }));
                        updateStreamingData({ hotels: mergedHotels });
                        break;
                      }

                      case "restaurants": {
                        const restaurants = parsedData.restaurants || [];
                        const mergedRestaurants = mergeUniqueById(
                          options.getStreamingData?.()?.restaurants,
                          restaurants,
                        );
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          restaurants: mergedRestaurants,
                        }));
                        updateStreamingData({ restaurants: mergedRestaurants });
                        break;
                      }

                      case "activities": {
                        const activities = parsedData.activities || [];
                        const mergedActivities = mergeUniqueById(
                          options.getStreamingData?.()?.activities,
                          activities,
                        );
                        options.setStreamingData?.((prev: any) => ({
                          ...prev,
                          activities: mergedActivities,
                        }));
                        updateStreamingData({ activities: mergedActivities });
                        break;
                      }
                    }
                  });
                }
              }
            }
            break;
          }

          case "session_validated":
            console.log("Session validated:", eventData.Data || eventData.data);
            break;

          case "progress": {
            // Show progress updates
            const progressData = eventData.Data || eventData.data;
            console.log("Progress:", progressData);

            // Set updating indicator for POI-related progress
            if (
              typeof progressData === "string" &&
              (progressData.includes("Adding Point of Interest") ||
                progressData.includes("extracting_poi_name") ||
                progressData.includes("generating_poi_data"))
            ) {
              setIsUpdatingItinerary(true);
              options.onUpdateStart?.();
            }
            break;
          }

          case "intent_classified":
            console.log("Intent classified:", eventData.Data || eventData.data);
            break;

          case "semantic_context_generated":
            console.log("Semantic context generated:", eventData.Data || eventData.data);
            break;

          case "restaurants": {
            const restaurantsData = decodeEventData(eventData.Data || eventData.data);
            console.log("🍽️ Received restaurants data:", restaurantsData);

            if (restaurantsData) {
              const currentSession =
                sessionId() ||
                eventData.SessionId ||
                eventData.sessionId ||
                (Array.isArray(restaurantsData) && restaurantsData[0]?.session_id);
              let mergedRestaurants = restaurantsData;
              if (options.setStreamingData) {
                options.setStreamingData((prev: any) => {
                  mergedRestaurants = mergeUniqueById(prev?.restaurants, restaurantsData);
                  return {
                    ...prev,
                    domain: "dining",
                    session_id: prev?.session_id || currentSession,
                    restaurants: mergedRestaurants,
                  };
                });
              }

              updateStreamingData({
                session_id: currentSession,
                restaurants: mergedRestaurants,
              });

              // Persist for deep links
              const snapshot = {
                session_id: currentSession,
                ...options.getStreamingData?.(),
                restaurants: mergedRestaurants,
              };
              persistCompletedSession(currentSession || sessionId(), snapshot);
              assistantMessage += "Updated restaurant picks. ";
            }
            break;
          }

          case "hotels": {
            const hotelsData = decodeEventData(eventData.Data || eventData.data);
            console.log("🏨 Received hotels data:", hotelsData);

            if (hotelsData) {
              const currentSession =
                sessionId() ||
                eventData.SessionId ||
                eventData.sessionId ||
                (Array.isArray(hotelsData) && hotelsData[0]?.session_id);
              let mergedHotels = hotelsData;
              if (options.setStreamingData) {
                options.setStreamingData((prev: any) => ({
                  ...prev,
                  domain: "accommodation",
                  session_id: prev?.session_id || currentSession,
                  hotels: mergeUniqueById(prev?.hotels, hotelsData),
                }));
              }

              updateStreamingData({
                session_id: currentSession,
                hotels: mergeUniqueById(options.getStreamingData?.()?.hotels, hotelsData),
              });

              // Persist for deep links
              mergedHotels = mergeUniqueById(options.getStreamingData?.()?.hotels, hotelsData);
              const snapshot = {
                session_id: currentSession,
                ...options.getStreamingData?.(),
                hotels: mergedHotels,
              };
              persistCompletedSession(currentSession || sessionId(), snapshot);
              assistantMessage += "Updated hotel options. ";
            }
            break;
          }

          case "activities": {
            const activitiesData = decodeEventData(eventData.Data || eventData.data);
            console.log("🎯 Received activities data:", activitiesData);

            if (activitiesData) {
              const currentSession =
                sessionId() ||
                eventData.SessionId ||
                eventData.sessionId ||
                (Array.isArray(activitiesData) && activitiesData[0]?.session_id);
              let mergedActivities = activitiesData;
              if (options.setStreamingData) {
                options.setStreamingData((prev: any) => ({
                  ...prev,
                  domain: "activities",
                  session_id: prev?.session_id || currentSession,
                  activities: mergeUniqueById(prev?.activities, activitiesData),
                }));
              }

              mergedActivities = mergeUniqueById(
                options.getStreamingData?.()?.activities,
                activitiesData,
              );

              updateStreamingData({
                session_id: currentSession,
                activities: mergedActivities,
              });

              // Persist for deep links
              const snapshot = {
                session_id: currentSession,
                ...options.getStreamingData?.(),
                activities: mergedActivities,
              };
              persistCompletedSession(currentSession || sessionId(), snapshot);
              assistantMessage += "Updated activities list. ";
            }
            break;
          }

          case "itinerary":
            {
              // This is the key event - update the itinerary data
              const rawItineraryData = decodeEventData(eventData.Data || eventData.data);
              // Normalize data format (camelCase -> snake_case)
              const itineraryData = normalizeItineraryData(rawItineraryData);
              const message = eventData.Message || eventData.message;
              const derivedLists = deriveDomainLists(itineraryData);

              console.log("📦 Received itinerary update (raw):", rawItineraryData);
              console.log("📦 Normalized itinerary data:", itineraryData);
              console.log("Itinerary message:", message);
              console.log(
                "Updated POIs count:",
                itineraryData?.itinerary_response?.points_of_interest?.length,
              );
              console.log("Updated POIs:", itineraryData?.itinerary_response?.points_of_interest);
              console.log("🔍 Derived lists:", {
                hotels: derivedLists.hotels.length,
                restaurants: derivedLists.restaurants.length,
                activities: derivedLists.activities.length,
              });
              console.log("🏨 Derived hotels:", derivedLists.hotels);
              console.log("🍽️ Derived restaurants:", derivedLists.restaurants);

              if (itineraryData) {
                // Store partial data in streaming session for progressive loading
                updateStreamingData(itineraryData);

                // Batch all related updates to prevent multiple re-renders
                batch(() => {
                  // Temporarily disable map during updates if available
                  if (options.setMapDisabled) {
                    options.setMapDisabled(true);
                  }

                  // Show update indicator
                  setIsUpdatingItinerary(true);
                  options.onUpdateStart?.();

                  // Update the streaming data with new itinerary information
                  if (options.setStreamingData) {
                    options.setStreamingData((prev: any) => {
                      if (!prev) return itineraryData;

                      // Use the helper function to detect incremental updates
                      const incremental = isIncrementalUpdate(itineraryData, prev);

                      console.log(
                        "🔍 Update type:",
                        incremental ? "INCREMENTAL (add to itinerary)" : "FULL (new query)",
                      );
                      if (incremental) {
                        console.log("✅ Updating ONLY custom itinerary, preserving general POIs");
                      }

                      const mergedHotels = mergeUniqueById(
                        prev?.hotels,
                        itineraryData.hotels || derivedLists.hotels,
                      );

                      const mergedRestaurants = mergeUniqueById(
                        prev?.restaurants,
                        itineraryData.restaurants || derivedLists.restaurants,
                      );

                      const mergedActivities = mergeUniqueById(
                        prev?.activities,
                        itineraryData.activities || derivedLists.activities,
                      );

                      console.log(
                        "🔄 BEFORE update - prev itinerary POIs:",
                        prev?.itinerary_response?.points_of_interest?.length,
                      );
                      console.log(
                        "🔄 INCOMING itinerary POIs:",
                        itineraryData?.itinerary_response?.points_of_interest?.length,
                      );
                      console.log(
                        "🔄 INCOMING full itinerary data:",
                        itineraryData?.itinerary_response,
                      );

                      const updatedData = {
                        ...prev,
                        // Update general city data if provided
                        ...(itineraryData.general_city_data && {
                          general_city_data: itineraryData.general_city_data,
                        }),
                        // Only update general points of interest for NEW queries, not incremental updates
                        // This prevents new POIs from appearing in the general list when they should only be in the custom itinerary
                        ...(!incremental && itineraryData.points_of_interest
                          ? {
                              points_of_interest: itineraryData.points_of_interest,
                            }
                          : {}),
                        // ALWAYS update itinerary response (this is the custom itinerary)
                        ...(itineraryData.itinerary_response && {
                          itinerary_response: itineraryData.itinerary_response,
                        }),
                        // ALWAYS update domain-specific lists with merged data
                        // This ensures hotels/restaurants pages get the accumulated POIs
                        hotels: mergedHotels,
                        restaurants: mergedRestaurants,
                        activities: mergedActivities,
                      };

                      console.log("🔧 Updated data with merged lists:", {
                        hotelsCount: mergedHotels.length,
                        restaurantsCount: mergedRestaurants.length,
                        activitiesCount: mergedActivities.length,
                      });

                      console.log(
                        "✅ AFTER update - updatedData itinerary POIs:",
                        updatedData?.itinerary_response?.points_of_interest?.length,
                      );
                      console.log("✅ AFTER update - full updatedData:", updatedData);

                      // Persist for cross-page usage
                      persistCompletedSession(
                        sessionId() || workingSessionId || itineraryData.session_id,
                        updatedData,
                      );

                      // Keep streaming state in sync for cross-page navigation
                      updateStreamingData(updatedData);

                      return updatedData;
                    });
                  }

                  // Trigger POI update without causing full re-render
                  if (options.setPoisUpdateTrigger) {
                    options.setPoisUpdateTrigger((prev) => prev + 1);
                  }
                });

                // Re-enable map after a short delay
                setTimeout(() => {
                  if (options.setMapDisabled) {
                    options.setMapDisabled(false);
                  }
                  options.onUpdateComplete?.();
                }, 1000);

                // Use the message from the server if available
                if (message) {
                  assistantMessage += message + " ";
                } else {
                  assistantMessage += "Your request has been updated. ";
                }

                console.log("✅ Content updated successfully");
              }
            }
            break;

          case "complete": {
            const completeMessage = eventData.Message || eventData.message;

            console.log("🏁 Complete event received");

            // Domain-specific events (hotels, restaurants, activities) already handle data updates
            // So we don't need to process itinerary data here to avoid duplicates

            if (completeMessage && completeMessage !== "Turn completed.") {
              assistantMessage += completeMessage;
            }

            // Mark streaming as complete
            markStreamingComplete();
            console.log("✅ Streaming complete - data finalized");

            // Handle navigation data if present (fallback for late navigation)
            const navigationData = eventData.Navigation || eventData.navigation;
            if (navigationData && options.enableNavigation) {
              console.log("Received navigation data:", navigationData);

              if (options.onNavigationData) {
                options.onNavigationData(navigationData);
              }

              // Only navigate if we haven't already (for sessions that didn't get early navigation)
              // Check if we're already on the target page
              if (navigationData.url || navigationData.URL) {
                const targetUrl = navigationData.url || navigationData.URL;
                const currentPath = window.location.pathname + window.location.search;

                // Only navigate if we're not already there
                if (!currentPath.includes(new URL(targetUrl, window.location.origin).pathname)) {
                  console.log("🧭 Late navigation to:", targetUrl);
                  navigate(targetUrl);
                } else {
                  console.log("📍 Already on target page, skipping navigation");
                }
              }
            }
            break;
          }

          case "error": {
            const errorMessage = eventData.Error || eventData.error || "Unknown error occurred";
            console.error("🚨 Received error event:", errorMessage);
            console.log("🔍 Full error event data:", eventData);

            // Only treat as session error if it's SPECIFICALLY about session not being found
            // Be very specific to avoid false positives
            if (
              (errorMessage.includes("failed to get session") &&
                errorMessage.includes("no rows in result set")) ||
              (errorMessage.includes("session") &&
                errorMessage.includes("not found") &&
                errorMessage.includes("database"))
            ) {
              console.log(
                "❌ Confirmed session database error detected, attempting to start new session...",
              );

              // Flag new session creation (handled after the stream ends).
              needsNewSession = true;
              assistantMessage += "Session expired. Starting new session... ";

              // We'll handle the new session creation after this stream ends
              // Don't throw error here, let it complete gracefully
              break;
            }

            // For other errors (like POI processing errors), just log them but continue
            console.log("⚠️  Non-session error, continuing processing:", errorMessage);
            assistantMessage += `Note: ${errorMessage} `;
            break;
          }

          default: {
            // Handle other event types or partial responses
            if (eventData.Message || eventData.message) {
              assistantMessage += eventData.Message || eventData.message;
            }
            console.log("Unhandled event type:", eventData.Type || eventData.type, eventData);
            break;
          }
        }
      }

      // Check if we need to start a new session
      if (needsNewSession) {
        console.log("Starting new session after session not found error...");
        await startNewSession(userMessage);
        return; // Exit early, new session will handle the response
      }

      // Add final assistant response to chat history
      if (assistantMessage.trim()) {
        setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: assistantMessage.trim(),
            timestamp: new Date(),
          },
        ]);
      } else {
        // If no specific message, provide a generic success message
        setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: "Your request has been processed successfully.",
            timestamp: new Date(),
          },
        ]);
      }

      // Call completion callback if provided
      if (options.onStreamingComplete) {
        options.onStreamingComplete(options.getStreamingData?.());
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Handle token expiration errors specifically
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTokenExpired =
        errorMessage.includes("token is expired") ||
        errorMessage.includes("invalid token") ||
        errorMessage.includes("unauthenticated");

      if (isTokenExpired) {
        setChatHistory((prev) => [
          ...prev,
          {
            type: "error",
            content: "Your session has expired. Please refresh the page to continue.",
            timestamp: new Date(),
          },
        ]);
      } else {
        // Run everything else through the shared parser so a daily-quota
        // rejection reads as "you're out of requests until midnight UTC"
        // instead of dumping the raw `resource_exhausted: ...` string.
        setChatHistory((prev) => [
          ...prev,
          {
            type: "error",
            content: parseStreamError(errorMessage).userMessage,
            timestamp: new Date(),
          },
        ]);
      }

      if (options.onError) {
        options.onError(error as Error);
      }
    } finally {
      setIsLoading(false);
      setIsUpdatingItinerary(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const clearChat = () => {
    setChatHistory([]);
    // Clear all session-related storage to prevent data bleed between city searches
    sessionStorage.removeItem("completedStreamingSession");
    sessionStorage.removeItem("currentStreamingSession");
    sessionStorage.removeItem("localChatSessions");
    sessionStorage.removeItem("lastKnownSessionId");
    sessionStorage.removeItem("fallbackSessionId");
    // Reset session ID to force new session creation
    setSessionId("");
  };

  const toggleChat = () => {
    setShowChat((prev) => !prev);
  };

  return {
    // State
    showChat,
    chatMessage,
    chatHistory,
    isLoading,
    sessionId,
    isUpdatingItinerary,

    // Actions
    setShowChat,
    setChatMessage,
    sendChatMessage,
    clearChat,
    toggleChat,
    handleKeyPress,
    setSessionId,

    // Derived state
    hasMessages: () => chatHistory().length > 0,
  };
}
