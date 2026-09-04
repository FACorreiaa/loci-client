import { createSignal, createMemo, onMount } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { detectDomain, useGetChatSessionsQuery } from "~/lib/api/llm";
import { createStreamingSession, streamingService } from "~/lib/chat-stream";
import type { DomainType } from "~/lib/api/types";
import type { TravelProfile } from "~/components/chat";
import { useUserLocation } from "~/contexts/LocationContext";
import { useDefaultSearchProfile, useSearchProfiles } from "~/lib/api/profiles";
import { useSaveItineraryMutation } from "~/lib/api/itineraries";
import { logger } from "~/lib/logger";
import { useAppQuery } from "../api/authed-query";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  hasItinerary?: boolean;
  streamingData?: any;
  showResults?: boolean;
  /** true only while this message is being streamed (drives typewriter). */
  streaming?: boolean;
}

const MAX_LOCAL_SESSIONS = 10;
const PROFILE_ICONS = ["🎒", "🍽️", "👨‍👩‍👧‍👦", "🎨", "📸", "🏔️", "🌴", "🏛️"];

const getCompletionMessage = (domain: DomainType, city?: string) => {
  const cityText = city ? `for ${city}` : "";
  switch (domain) {
    case "accommodation":
      return `Great! I've found some excellent hotel options ${cityText}. Click below to view all recommendations and book your stay.`;
    case "dining":
      return `Perfect! I've discovered amazing restaurants ${cityText} that match your preferences. Explore the full list to find your next dining experience.`;
    case "activities":
      return `Wonderful! I've curated exciting activities and attractions ${cityText}. Check out all the options to plan your perfect day.`;
    default:
      return `Excellent! I've created a personalized itinerary ${cityText} based on your preferences. View the complete plan with all the details, maps, and recommendations.`;
  }
};

const welcomeMessage = (profile: string): ChatMessage => ({
  id: "welcome",
  type: "assistant",
  content: `Hello! I'm your AI travel assistant. I'll help you discover amazing places and create personalized itineraries based on your preferences.\n\nCurrently using your "${profile}" profile. What would you like to explore today?`,
  timestamp: new Date(),
  hasItinerary: false,
});

/**
 * All /chat state + actions. The route only wires this into the view components.
 */
export function useChat() {
  const queryClient = useQueryClient();

  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = createSignal<string | undefined>(undefined);
  const [showProfileSelector, setShowProfileSelector] = createSignal(false);
  const [selectedSession, setSelectedSession] = createSignal<any | null>(null);
  const [streamingSession, setStreamingSession] = createSignal<any>(null);
  const [streamProgress, setStreamProgress] = createSignal("");
  const [expandedResults, setExpandedResults] = createSignal<Set<string>>(new Set());
  const [localSessionsVersion, setLocalSessionsVersion] = createSignal(0);
  // id of the assistant message currently being streamed into (live render).
  const [streamingMessageId, setStreamingMessageId] = createSignal<string | null>(null);

  const { userLocation } = useUserLocation() as any;
  const userLatitude = userLocation()?.latitude || 38.7223;
  const userLongitude = userLocation()?.longitude || -9.1393;

  const defaultProfileQuery = useDefaultSearchProfile();
  const searchProfilesQuery = useSearchProfiles();
  const saveItineraryMutation = useSaveItineraryMutation();

  /** Real profiles from the API, mapped to the sidebar's display shape. */
  const profiles = createMemo<TravelProfile[]>(() =>
    (searchProfilesQuery.data || []).map((p, i) => ({
      id: p.id,
      name: p.profile_name,
      icon: PROFILE_ICONS[i % PROFILE_ICONS.length],
      description: p.is_default ? "Default profile" : "Search profile",
    })),
  );

  /** Effective profile id sent to the backend (chosen, else default). */
  const activeProfileId = () => selectedProfileId() ?? defaultProfileQuery.data?.id;
  const activeProfileName = () =>
    profiles().find((p) => p.id === activeProfileId())?.name || "Default";

  const selectProfileByName = (name: string) => {
    const match = profiles().find((p) => p.name === name);
    if (match) setSelectedProfileId(match.id);
    setShowProfileSelector(false);
  };

  const chatSessionsQuery = useAppQuery(() => useGetChatSessionsQuery(activeProfileId()));

  /** API sessions merged with the local fallback list (local de-duped). */
  const sessions = () => {
    localSessionsVersion(); // reactive dependency
    const apiSessions = chatSessionsQuery.data || [];
    try {
      const localSessions = JSON.parse(localStorage.getItem("localChatSessions") || "[]");
      if (!chatSessionsQuery.isError && apiSessions.length > 0) {
        const apiIds = new Set(apiSessions.map((s) => s.id));
        const uniqueLocal = localSessions.filter((s: any) => !apiIds.has(s.id));
        return [...apiSessions, ...uniqueLocal];
      }
      if (localSessions.length > 0) return localSessions;
    } catch (error) {
      logger.warn("Failed to load local sessions:", error);
    }
    return apiSessions;
  };

  // Clear only the *streaming* keys on mount — never the session list (wiping
  // localChatSessions here made recent conversations vanish on every load).
  onMount(() => {
    sessionStorage.removeItem("currentStreamingSession");
    sessionStorage.removeItem("completedStreamingSession");
    setSessionId(null);
    setStreamingSession(null);
    setMessages([welcomeMessage(activeProfileName())]);
  });

  const appendMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);
  const patchMessage = (id: string, partial: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...partial } : m)));

  const sendMessage = async () => {
    if (!currentMessage().trim() || isLoading()) return;

    const messageContent = currentMessage().trim();
    appendMessage({
      id: `msg-${Date.now()}`,
      type: "user",
      content: messageContent,
      timestamp: new Date(),
    });

    // Push a streaming placeholder the stream patches live (text + results).
    const streamId = `msg-${Date.now()}-response`;
    setStreamingMessageId(streamId);
    appendMessage({
      id: streamId,
      type: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    });

    setCurrentMessage("");
    setIsLoading(true);
    setStreamProgress("Analyzing your request...");

    try {
      const currentSessionId = sessionId();
      if (currentSessionId) {
        await continueExistingSession(currentSessionId, messageContent, streamId);
      } else {
        await startNewSession(messageContent, streamId);
      }
    } catch (error) {
      logger.error("Error sending message:", error);
      finishWithError(
        streamId,
        "Sorry, there was an error processing your request. Please try again.",
      );
    }
  };

  const finishWithError = (streamId: string, content: string) => {
    setIsLoading(false);
    setStreamProgress("");
    setStreamingMessageId(null);
    patchMessage(streamId, { type: "error", content, streaming: false, streamingData: undefined });
  };

  const persistLocalSession = (completed: any) => {
    try {
      const localSessions = JSON.parse(localStorage.getItem("localChatSessions") || "[]");
      const data = completed.data || {};
      const summary = {
        id: completed.sessionId,
        title:
          data.itinerary_response?.itinerary_name ||
          `Trip to ${completed.city}` ||
          "New Conversation",
        preview: `Created an itinerary for ${completed.city || "your destination"}`,
        timestamp: new Date().toISOString(),
        messageCount: 2,
        hasItinerary: !!(data.points_of_interest || data.itinerary_response),
        cityName: completed.city,
        isLocal: true,
      };
      localSessions.unshift(summary);
      if (localSessions.length > MAX_LOCAL_SESSIONS) localSessions.splice(MAX_LOCAL_SESSIONS);
      localStorage.setItem("localChatSessions", JSON.stringify(localSessions));
      queryClient.invalidateQueries({ queryKey: ["chatSessions", activeProfileId()] });
      setLocalSessionsVersion((v) => v + 1);
    } catch (error) {
      logger.error("Failed to save session locally:", error);
    }
  };

  const progressLabel = (updated: any) => {
    if ("general_city_data" in updated.data && updated.data.general_city_data) {
      return `Found information about ${updated.data.general_city_data.city}...`;
    }
    if (updated.domain === "accommodation") return "Finding hotels...";
    if (updated.domain === "dining") return "Searching restaurants...";
    if (updated.domain === "activities") return "Discovering activities...";
    return "Creating your itinerary...";
  };

  const startNewSession = async (messageContent: string, streamId: string) => {
    const domain = detectDomain(messageContent);
    const session = createStreamingSession(domain);
    session.query = messageContent;
    setStreamingSession(session);
    sessionStorage.setItem("currentStreamingSession", JSON.stringify(session));

    const profile = activeProfileId();
    if (!profile) throw new Error("No search profile found");

    streamingService.startStream(
      {
        message: messageContent,
        profileId: profile,
        userLocation: { userLat: userLatitude, userLon: userLongitude },
      },
      {
        session,
        onProgress: (updated) => {
          setStreamingSession({ ...updated });
          setStreamProgress(progressLabel(updated));
          // Live: surface partial results in the streaming message as they arrive.
          patchMessage(streamId, { streamingData: updated.data });
          sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated));
        },
        onComplete: (completed) => finalizeStream(completed, streamId),
        onError: (error) => {
          logger.error("Streaming error:", error);
          finishWithError(streamId, `Sorry, there was an error processing your request: ${error}`);
        },
      },
    );
  };

  const continueExistingSession = async (
    existingSessionId: string,
    messageContent: string,
    streamId: string,
  ) => {
    setStreamProgress("Continuing conversation...");
    const domain = detectDomain(messageContent);
    const profile = activeProfileId();
    if (!profile) throw new Error("No search profile found");

    const currentCity =
      streamingSession()?.city || streamingSession()?.data?.general_city_data?.city || "";

    const session = createStreamingSession(domain);
    session.query = messageContent;
    session.sessionId = existingSessionId;
    session.city = currentCity;
    setStreamingSession(session);

    // Real continuation: reuse the same stream keyed by sessionId. The server
    // resumes the existing session instead of minting a new one. An expired
    // session surfaces as an error event (onError), which clears sessionId so the
    // next send starts fresh.
    streamingService.startStream(
      {
        message: messageContent,
        profileId: profile,
        sessionId: existingSessionId,
        cityName: currentCity,
        userLocation: { userLat: userLatitude, userLon: userLongitude },
      },
      {
        session,
        onProgress: (updated) => {
          setStreamingSession({ ...updated });
          setStreamProgress(
            "general_city_data" in updated.data && updated.data.general_city_data
              ? `Processing updates for ${updated.data.general_city_data.city}...`
              : "Processing your follow-up request...",
          );
          patchMessage(streamId, { streamingData: updated.data });
          sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated));
        },
        onComplete: (completed) => finalizeStream(completed, streamId),
        onError: (error) => {
          logger.error("ContinueChat streaming error:", error);
          if (error.includes("not found") || error.includes("expired")) setSessionId(null);
          finishWithError(
            streamId,
            `Sorry, there was an error: ${error}. Try sending your message again.`,
          );
        },
      },
    );
  };

  /** Finalize the streaming placeholder into a completed assistant message. */
  const finalizeStream = (completed: any, streamId: string) => {
    setStreamingSession(completed);
    setIsLoading(false);
    setStreamProgress("");
    setStreamingMessageId(null);
    if (completed.sessionId) {
      setSessionId(completed.sessionId);
      persistLocalSession(completed);
    }
    patchMessage(streamId, {
      content: getCompletionMessage(completed.domain, completed.city),
      hasItinerary: true,
      streamingData: completed.data,
      showResults: true,
      streaming: false,
    });
    sessionStorage.setItem("completedStreamingSession", JSON.stringify(completed));
    const pid = activeProfileId();
    if (pid) queryClient.invalidateQueries({ queryKey: ["chatSessions", pid] });
  };

  /** Stop the in-flight stream — finalizes the partial answer, no error. */
  const stopStreaming = () => {
    if (!isLoading()) return;
    streamingService.stop();
  };

  const newChat = () => {
    setMessages([
      {
        id: "welcome-new",
        type: "assistant",
        content: `Hello! I'm ready to help you plan your next adventure. What would you like to explore today?`,
        timestamp: new Date(),
        hasItinerary: false,
      },
    ]);
    setSessionId(null);
    setSelectedSession(null);
    setStreamingSession(null);
    setStreamProgress("");
    setStreamingMessageId(null);
    setExpandedResults(new Set<string>());
    sessionStorage.removeItem("currentStreamingSession");
    sessionStorage.removeItem("completedStreamingSession");
    sessionStorage.removeItem("lastKnownSessionId");
    sessionStorage.removeItem("fallbackSessionId");
  };

  /**
   * Load a past conversation. History comes from the cached getChatSessions
   * result (the Connect RPC already returns conversationHistory) — the old REST
   * details endpoint was removed.
   */
  const loadSession = (session: any) => {
    setSelectedSession(session);
    setCurrentMessage("");
    setExpandedResults(new Set<string>());
    sessionStorage.removeItem("currentStreamingSession");
    sessionStorage.removeItem("completedStreamingSession");
    setIsLoading(true);
    setStreamProgress("Loading conversation history...");

    try {
      const full = sessions().find((s: any) => s.id === session.id) || session;
      const history = full.conversationHistory || full.conversation_history || [];

      let conversationMessages: ChatMessage[];
      if (history.length > 0) {
        conversationMessages = history.map((msg: any, index: number) => ({
          id: `session-${session.id}-msg-${index}`,
          type: msg.role === "user" ? "user" : "assistant",
          content: msg.content || msg.message || "No content available",
          timestamp: new Date(msg.timestamp || msg.created_at || full.timestamp),
          hasItinerary: msg.role === "assistant" && !!(msg.data || msg.streaming_data),
          streamingData: msg.data || msg.streaming_data || null,
          showResults: msg.role === "assistant" && !!(msg.data || msg.streaming_data),
        }));
      } else {
        conversationMessages = [
          {
            id: `session-${session.id}-placeholder-user`,
            type: "user",
            content: session.preview || "Previous conversation",
            timestamp: new Date(session.timestamp),
          },
          {
            id: `session-${session.id}-placeholder-assistant`,
            type: "assistant",
            content: `I helped you with ${(session.title || "your trip").toLowerCase()}${session.cityName ? ` in ${session.cityName}` : ""}.`,
            timestamp: new Date(session.timestamp),
            hasItinerary: session.hasItinerary || false,
          },
        ];
      }

      setSessionId(session.id);

      const lastWithData = [...history]
        .reverse()
        .find((msg: any) => msg.role === "assistant" && msg.data);
      if (lastWithData?.data) {
        const restored = {
          sessionId: session.id,
          domain: lastWithData.data.domain || "general",
          city: session.cityName || lastWithData.data.general_city_data?.city,
          query: "",
          data: lastWithData.data,
        };
        setStreamingSession(restored);
        sessionStorage.setItem("completedStreamingSession", JSON.stringify(restored));
      }

      setMessages([
        ...conversationMessages,
        {
          id: "session-loaded",
          type: "assistant",
          content: `Welcome back! I've loaded our previous conversation${session.cityName ? ` about your trip to ${session.cityName}` : ""} with ${conversationMessages.length} messages. How can I help you continue planning?`,
          timestamp: new Date(),
          hasItinerary: false,
        },
      ]);
    } catch (error) {
      logger.error("Error loading session:", error);
      setMessages([
        {
          id: "session-error",
          type: "assistant",
          content: session.cityName
            ? `I found your previous conversation about ${session.cityName}, but couldn't load the full history. Let's continue from here!`
            : `I found your previous conversation, but couldn't load the full history. Let's continue from here!`,
          timestamp: new Date(),
          hasItinerary: session.hasItinerary || false,
        },
      ]);
      setSessionId(session.id);
    } finally {
      setIsLoading(false);
      setStreamProgress("");
    }
  };

  const toggleResultExpansion = (messageId: string) => {
    setExpandedResults((prev) => {
      const next = new Set<string>(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  /** Bookmark the itinerary attached to a message. */
  const saveMessage = async (message: ChatMessage) => {
    const city = message.streamingData?.general_city_data;
    if (!city?.city) return;
    try {
      await saveItineraryMutation.mutateAsync({
        session_id: sessionId() || message.streamingData?.session_id,
        primary_city_name: city.city,
        title: `${city.city} Itinerary`,
        description: city.description || `Itinerary for ${city.city}`,
        tags: [],
        is_public: false,
      });
    } catch (error) {
      logger.error("Failed to bookmark itinerary:", error);
    }
  };

  /** Share the current conversation via the Web Share API. */
  const shareMessage = (message: ChatMessage) => {
    const city = message.streamingData?.general_city_data?.city;
    const title = city ? `Itinerary for ${city}` : "My Loci itinerary";
    if (navigator.share) {
      navigator.share({ title, text: title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
  };

  return {
    // state
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    sessionId,
    showProfileSelector,
    setShowProfileSelector,
    selectedSession,
    streamingSession,
    streamProgress,
    expandedResults,
    streamingMessageId,
    // profiles
    profiles,
    activeProfileName,
    selectProfileByName,
    // derived
    sessions,
    chatSessionsQuery,
    // actions
    sendMessage,
    stopStreaming,
    newChat,
    loadSession,
    toggleResultExpansion,
    saveMessage,
    shareMessage,
  };
}
