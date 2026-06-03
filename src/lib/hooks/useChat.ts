import { createSignal, onMount } from "solid-js";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import {
  ContinueChatStream,
  detectDomain,
  useGetChatSessionsQuery,
  domainToContextType,
} from "~/lib/api/llm";
import {
  createStreamingSession,
  sendUnifiedChatMessageStream,
  streamingService,
} from "~/lib/chat-stream";
import type { DomainType } from "~/lib/api/types";
import { useUserLocation } from "~/contexts/LocationContext";
import { useDefaultSearchProfile } from "~/lib/api/profiles";
import { logger } from "~/lib/logger";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  hasItinerary?: boolean;
  streamingData?: any;
  showResults?: boolean;
  /** true only for the message currently being streamed (drives typewriter). */
  streaming?: boolean;
}

const MAX_LOCAL_SESSIONS = 10;

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
  const [activeProfile, setActiveProfile] = createSignal("Solo Explorer");
  const [showProfileSelector, setShowProfileSelector] = createSignal(false);
  const [selectedSession, setSelectedSession] = createSignal<any | null>(null);
  const [streamingSession, setStreamingSession] = createSignal<any>(null);
  const [streamProgress, setStreamProgress] = createSignal("");
  const [expandedResults, setExpandedResults] = createSignal<Set<string>>(new Set());
  const [localSessionsVersion, setLocalSessionsVersion] = createSignal(0);

  const { userLocation } = useUserLocation() as any;
  const userLatitude = userLocation()?.latitude || 38.7223;
  const userLongitude = userLocation()?.longitude || -9.1393;

  const defaultProfileQuery = useDefaultSearchProfile();
  const profileId = () => defaultProfileQuery.data?.id;

  const chatSessionsQuery = useQuery(() => useGetChatSessionsQuery(profileId()));

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
    setMessages([welcomeMessage(activeProfile())]);
  });

  const appendMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const sendMessage = async () => {
    if (!currentMessage().trim() || isLoading()) return;

    const messageContent = currentMessage().trim();
    appendMessage({
      id: `msg-${Date.now()}`,
      type: "user",
      content: messageContent,
      timestamp: new Date(),
    });
    setCurrentMessage("");
    setIsLoading(true);
    setStreamProgress("Analyzing your request...");

    try {
      const currentSessionId = sessionId();
      if (currentSessionId) {
        await continueExistingSession(currentSessionId, messageContent);
      } else {
        await startNewSession(messageContent);
      }
    } catch (error) {
      logger.error("Error sending message:", error);
      setIsLoading(false);
      setStreamProgress("");
      appendMessage({
        id: `msg-${Date.now()}-error`,
        type: "error",
        content: "Sorry, there was an error processing your request. Please try again.",
        timestamp: new Date(),
      });
    }
  };

  const persistLocalSession = (completedSession: any) => {
    try {
      const localSessions = JSON.parse(localStorage.getItem("localChatSessions") || "[]");
      const data = completedSession.data || {};
      const summary = {
        id: completedSession.sessionId,
        title:
          data.itinerary_response?.itinerary_name ||
          `Trip to ${completedSession.city}` ||
          "New Conversation",
        preview: `Created an itinerary for ${completedSession.city || "your destination"}`,
        timestamp: new Date().toISOString(),
        messageCount: 2,
        hasItinerary: !!(data.points_of_interest || data.itinerary_response),
        cityName: completedSession.city,
        isLocal: true,
      };
      localSessions.unshift(summary);
      if (localSessions.length > MAX_LOCAL_SESSIONS) localSessions.splice(MAX_LOCAL_SESSIONS);
      localStorage.setItem("localChatSessions", JSON.stringify(localSessions));
      queryClient.invalidateQueries({ queryKey: ["chatSessions", profileId()] });
      setLocalSessionsVersion((v) => v + 1);
    } catch (error) {
      logger.error("Failed to save session locally:", error);
    }
  };

  const startNewSession = async (messageContent: string) => {
    const domain = detectDomain(messageContent);
    const session = createStreamingSession(domain);
    session.query = messageContent;
    setStreamingSession(session);
    sessionStorage.setItem("currentStreamingSession", JSON.stringify(session));

    const currentProfileId = profileId();
    if (!currentProfileId) throw new Error("No default search profile found");

    const response = await sendUnifiedChatMessageStream({
      profileId: currentProfileId,
      message: messageContent,
      contextType: domainToContextType(domain),
      userLocation: { userLat: userLatitude, userLon: userLongitude },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    streamingService.startStream(response, {
      session,
      onProgress: (updated) => {
        setStreamingSession({ ...updated });
        if ("general_city_data" in updated.data && updated.data.general_city_data) {
          setStreamProgress(`Found information about ${updated.data.general_city_data.city}...`);
        } else if (updated.domain === "accommodation") {
          setStreamProgress("Finding hotels...");
        } else if (updated.domain === "dining") {
          setStreamProgress("Searching restaurants...");
        } else if (updated.domain === "activities") {
          setStreamProgress("Discovering activities...");
        } else {
          setStreamProgress("Creating your itinerary...");
        }
        sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated));
      },
      onComplete: (completed) => {
        setStreamingSession(completed);
        setIsLoading(false);
        setStreamProgress("");
        if (completed.sessionId) {
          setSessionId(completed.sessionId);
          persistLocalSession(completed);
        }
        appendMessage({
          id: `msg-${Date.now()}-response`,
          type: "assistant",
          content: getCompletionMessage(completed.domain, completed.city),
          timestamp: new Date(),
          hasItinerary: true,
          streamingData: completed.data,
          showResults: true,
        });
        sessionStorage.setItem("completedStreamingSession", JSON.stringify(completed));
        const pid = profileId();
        if (pid) queryClient.invalidateQueries({ queryKey: ["chatSessions", pid] });
      },
      onError: (error) => {
        logger.error("Streaming error:", error);
        setIsLoading(false);
        setStreamProgress("");
        appendMessage({
          id: `msg-${Date.now()}-error`,
          type: "error",
          content: `Sorry, there was an error processing your request: ${error}`,
          timestamp: new Date(),
        });
      },
    });
  };

  const continueExistingSession = async (existingSessionId: string, messageContent: string) => {
    setStreamProgress("Continuing conversation...");
    const domain = detectDomain(messageContent);
    const currentProfileId = profileId();
    if (!currentProfileId) throw new Error("No default search profile found");

    const currentCity =
      streamingSession()?.city || streamingSession()?.data?.general_city_data?.city || "";

    try {
      const response = await ContinueChatStream({
        sessionId: existingSessionId,
        message: messageContent,
        cityName: currentCity,
        contextType: domainToContextType(domain),
      });

      if (!response.ok) {
        logger.warn("ContinueChat failed, session may be expired. Starting new session.");
        setSessionId(null);
        await startNewSession(messageContent);
        return;
      }

      const session = createStreamingSession(domain);
      session.query = messageContent;
      session.sessionId = existingSessionId;
      session.city = currentCity;
      setStreamingSession(session);

      streamingService.startStream(response, {
        session,
        onProgress: (updated) => {
          setStreamingSession({ ...updated });
          if ("general_city_data" in updated.data && updated.data.general_city_data) {
            setStreamProgress(`Processing updates for ${updated.data.general_city_data.city}...`);
          } else {
            setStreamProgress("Processing your follow-up request...");
          }
          sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated));
        },
        onComplete: (completed) => {
          setStreamingSession(completed);
          setIsLoading(false);
          setStreamProgress("");
          appendMessage({
            id: `msg-${Date.now()}-response`,
            type: "assistant",
            content: getCompletionMessage(completed.domain, completed.city),
            timestamp: new Date(),
            hasItinerary: true,
            streamingData: completed.data,
            showResults: true,
          });
          sessionStorage.setItem("completedStreamingSession", JSON.stringify(completed));
          const pid = profileId();
          if (pid) queryClient.invalidateQueries({ queryKey: ["chatSessions", pid] });
        },
        onError: (error) => {
          logger.error("ContinueChat streaming error:", error);
          if (error.includes("not found") || error.includes("expired")) setSessionId(null);
          setIsLoading(false);
          setStreamProgress("");
          appendMessage({
            id: `msg-${Date.now()}-error`,
            type: "error",
            content: `Sorry, there was an error: ${error}. Try sending your message again.`,
            timestamp: new Date(),
          });
        },
      });
    } catch (error) {
      logger.error("ContinueChat exception, falling back to new session:", error);
      setSessionId(null);
      await startNewSession(messageContent);
    }
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
    setExpandedResults(new Set<string>());
    // Clear only the active-streaming keys — keep the saved session list.
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

  return {
    // state
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    sessionId,
    activeProfile,
    setActiveProfile,
    showProfileSelector,
    setShowProfileSelector,
    selectedSession,
    streamingSession,
    streamProgress,
    expandedResults,
    // derived
    sessions,
    chatSessionsQuery,
    // actions
    sendMessage,
    newChat,
    loadSession,
    toggleResultExpansion,
  };
}
