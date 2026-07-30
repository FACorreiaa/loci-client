// LLM and chat queries and mutations
import { useMutation } from "@tanstack/solid-query";
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { defaultLLMRateLimiter, RateLimitError, showRateLimitNotification } from "../rate-limiter";
import {
  ChatService,
  ChatResponse as ProtoChatResponse,
  ChatSession as ProtoChatSession,
  ContinueChatRequestSchema,
  DomainType as ChatDomainType,
  MessageRole,
  StartChatRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import {
  AIItineraryResponse as ProtoAIItineraryResponse,
  AiCityResponse as ProtoAiCityResponse,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { GeneralCityData as ProtoGeneralCityData } from "@buf/loci_loci-proto.bufbuild_es/loci/city/city_pb.js";
import {
  POIDetailedInfo as ProtoPOIDetailedInfo,
  RestaurantDetailedInfo as ProtoRestaurantDetailedInfo,
} from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import { transport } from "../connect-transport";
import { fromProtoRecommendationTrace } from "./recommendations";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
//import { createGraphQLClient, gql } from '@solid-primitives/graphql';
import type {
  ChatMessage,
  DomainType as ClientDomainType,
  GeneralCityData,
  AIItineraryResponse,
  AiCityResponse,
  POIDetailedInfo,
  RestaurantDetailedInfo,
  SessionPerformanceMetrics,
  SessionContentMetrics,
  SessionEngagementMetrics,
} from "./types";

// ==================
// CHAT/LLM TYPES
// ==================

export type ChatContextType = "hotels" | "restaurants" | "itineraries" | "general";

const chatClient = createClient(ChatService, transport);

const timestampToDate = (timestamp?: Timestamp): Date => {
  if (!timestamp) return new Date(0);
  return new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1_000_000);
};

const timestampToISOString = (timestamp?: Timestamp): string =>
  timestampToDate(timestamp).toISOString();

const EMPTY_ITINERARY: AIItineraryResponse = {
  itinerary_name: "",
  overall_description: "",
  points_of_interest: [],
  restaurants: [],
  bars: [],
};

export const toProtoDomainType = (contextType?: ChatContextType): ChatDomainType => {
  switch (contextType) {
    case "hotels":
      return ChatDomainType.ACCOMMODATION;
    case "restaurants":
      return ChatDomainType.DINING;
    case "itineraries":
      return ChatDomainType.ITINERARY;
    default:
      return ChatDomainType.GENERAL;
  }
};

const toClientDomainType = (contextType?: ChatContextType): ClientDomainType => {
  switch (contextType) {
    case "hotels":
      return "accommodation";
    case "restaurants":
      return "dining";
    case "itineraries":
      return "itinerary";
    default:
      return "general";
  }
};

export const domainToContextType = (domain: ClientDomainType | string): ChatContextType => {
  switch (domain) {
    case "accommodation":
      return "hotels";
    case "dining":
      return "restaurants";
    case "itinerary":
      return "itineraries";
    case "activities":
      return "general";
    default:
      return "general";
  }
};

export const mapGeneralCityData = (data?: ProtoGeneralCityData): GeneralCityData | undefined => {
  if (!data) return undefined;

  return {
    city: data.city || "",
    country: data.country || "",
    state_province: data.stateProvince || "",
    description: data.description || "",
    center_latitude: data.centerLatitude ?? 0,
    center_longitude: data.centerLongitude ?? 0,
    population: data.population || "",
    area: data.area || "",
    timezone: data.timezone || "",
    language: data.language || "",
    weather: data.weather || "",
    attractions: data.attractions || "",
    history: data.history || "",
  };
};

export const mapPoi = (poi: ProtoPOIDetailedInfo): POIDetailedInfo => {
  const placeholderId = poi.id === "00000000-0000-0000-0000-000000000000";
  const safeId =
    !placeholderId && poi.id
      ? poi.id
      : `${poi.name}-${poi.city || "unknown"}`.toLowerCase().replace(/\s+/g, "-");

  return {
    id: safeId,
    // city: poi.city, removed duplicate
    city_id: poi.cityId,
    name: poi.name,
    latitude: poi.latitude ?? 0,
    longitude: poi.longitude ?? 0,
    category: poi.category,
    description: poi.description || poi.descriptionPoi || "",
    city: poi.city || "", // Ensure city is string
    address: poi.address || "",
    website: poi.website || "",
    phone_number: poi.phoneNumber || "",
    opening_hours:
      typeof poi.openingHours === "object"
        ? JSON.stringify(poi.openingHours)
        : (poi.openingHours as unknown as string) || "",
    price_level: poi.priceLevel || "",
    price_range: poi.priceRange || "",
    rating: poi.rating,
    tags: poi.tags || [],
    images: poi.images || [],
    llm_interaction_id: poi.llmInteractionId || "",
    cuisine_type: poi.cuisineType || "",
    star_rating:
      typeof poi.starRating === "string" ? parseFloat(poi.starRating) : poi.starRating || 0,
    distance: poi.distance || 0,
    description_poi: poi.descriptionPoi || "",
    recommendation_rationale: poi.recommendationRationale || "",
    uncertainty_score: poi.uncertaintyScore,
    missing_data: poi.missingData || [],
    recommendation_trace: fromProtoRecommendationTrace(poi.recommendationTrace),
    created_at:
      poi.createdAt && typeof (poi.createdAt as any).toDate === "function"
        ? (poi.createdAt as any).toDate().toISOString()
        : undefined,
  };
};

const mapRestaurant = (
  restaurant: ProtoRestaurantDetailedInfo | ProtoPOIDetailedInfo,
): RestaurantDetailedInfo => ({
  id: restaurant.id,
  city: restaurant.city,
  name: restaurant.name,
  latitude: restaurant.latitude ?? 0,
  longitude: restaurant.longitude ?? 0,
  category: restaurant.category,
  description:
    (restaurant as ProtoRestaurantDetailedInfo).description ||
    (restaurant as ProtoPOIDetailedInfo).description ||
    (restaurant as ProtoPOIDetailedInfo).descriptionPoi ||
    "",
  address: restaurant.address || "",
  website: restaurant.website || "",
  phone_number:
    (restaurant as ProtoRestaurantDetailedInfo).phoneNumber ||
    (restaurant as ProtoPOIDetailedInfo).phoneNumber ||
    "",
  opening_hours: (typeof (restaurant as ProtoRestaurantDetailedInfo).openingHours === "object"
    ? JSON.stringify((restaurant as ProtoRestaurantDetailedInfo).openingHours)
    : typeof (restaurant as ProtoRestaurantDetailedInfo).openingHours === "string"
      ? (restaurant as ProtoRestaurantDetailedInfo).openingHours
      : (restaurant as ProtoPOIDetailedInfo).openingHours || "") as string,
  price_level:
    (restaurant as ProtoRestaurantDetailedInfo).priceLevel ||
    (restaurant as ProtoPOIDetailedInfo).priceLevel ||
    "",
  cuisine_type:
    (restaurant as ProtoRestaurantDetailedInfo).cuisineType ||
    (restaurant as ProtoPOIDetailedInfo).cuisineType ||
    "",
  tags: restaurant.tags || [],
  images: restaurant.images || [],
  rating: restaurant.rating ?? 0,
  llm_interaction_id:
    (restaurant as ProtoRestaurantDetailedInfo).llmInteractionId ||
    (restaurant as ProtoPOIDetailedInfo).llmInteractionId ||
    "",
  recommendation_trace: fromProtoRecommendationTrace(restaurant.recommendationTrace),
});

export const mapItineraryResponse = (
  response?: ProtoAIItineraryResponse,
): AIItineraryResponse | undefined => {
  if (!response) return undefined;

  return {
    itinerary_name: response.itineraryName,
    overall_description: response.overallDescription,
    points_of_interest: response.pointsOfInterest?.map(mapPoi) ?? [],
    restaurants: response.restaurants?.map(mapRestaurant) ?? [],
    bars: response.bars?.map(mapRestaurant) ?? [],
  };
};

export const mapAiCityResponse = (response?: ProtoAiCityResponse): AiCityResponse | undefined => {
  if (!response) return undefined;

  const mappedItinerary =
    mapItineraryResponse(response.itineraryResponse) ||
    (EMPTY_ITINERARY as unknown as AIItineraryResponse);

  const hotelsFromAccommodation =
    // @ts-expect-error: backend may return accommodationResponse
    response.accommodationResponse?.hotels?.map(mapPoi) ||
    // Older snake_case variant
    // @ts-expect-error
    response.accommodation_response?.hotels?.map(mapPoi) ||
    [];

  const deriveLists = () => {
    const points =
      response.pointsOfInterest?.map(mapPoi) || mappedItinerary.points_of_interest || [];

    const hotels = points.filter((poi) => (poi.category || "").toLowerCase().includes("hotel"));
    const restaurants = points.filter((poi) => {
      const cat = (poi.category || "").toLowerCase();
      return cat.includes("restaurant") || cat.includes("dining");
    });
    const activities = points.filter(
      (poi) =>
        !(poi.category || "").toLowerCase().includes("hotel") &&
        !(poi.category || "").toLowerCase().includes("restaurant") &&
        !(poi.category || "").toLowerCase().includes("dining"),
    );

    return { hotels, restaurants, activities };
  };

  const derived = deriveLists();

  return {
    general_city_data: (mapGeneralCityData(response.generalCityData) as GeneralCityData) || {
      city: "",
      country: "",
      state_province: "",
      description: "",
      center_latitude: 0,
      center_longitude: 0,
      population: "",
      area: "",
      timezone: "",
      language: "",
      weather: "",
      attractions: "",
      history: "",
    },
    points_of_interest: response.pointsOfInterest?.map(mapPoi) ?? [],
    itinerary_response: mappedItinerary,
    hotels: hotelsFromAccommodation || derived.hotels,
    restaurants: mappedItinerary.restaurants?.length
      ? mappedItinerary.restaurants
      : (derived.restaurants as unknown as RestaurantDetailedInfo[]),
    bars: mappedItinerary.bars,
    session_id: response.sessionId,
  };
};

export interface NormalizedChatResponse {
  sessionId: string;
  message: string;
  updatedItinerary?: AiCityResponse;
  domain: ClientDomainType;
  isNewSession: boolean;
  requiresClarification: boolean;
  suggestedActions: string[];
}

const normalizeChatResponse = (
  response: ProtoChatResponse,
  contextType?: ChatContextType,
): NormalizedChatResponse => {
  const domain = toClientDomainType(contextType);

  return {
    sessionId: response.sessionId,
    message: response.message,
    updatedItinerary: mapAiCityResponse(response.updatedItinerary),
    domain,
    isNewSession: response.isNewSession,
    requiresClarification: response.requiresClarification,
    suggestedActions: response.suggestedActions || [],
  };
};

const enforceRateLimit = async (endpoint: string) => {
  const rateLimitCheck = await defaultLLMRateLimiter.checkRateLimit(endpoint);
  if (!rateLimitCheck.allowed) {
    const retryAfter = rateLimitCheck.retryAfter || 60;
    showRateLimitNotification(retryAfter, endpoint);
    throw new RateLimitError(
      `Rate limit exceeded for ${endpoint}. Retry after ${retryAfter} seconds.`,
      retryAfter,
      endpoint,
    );
  }
};

export interface StartChatRequest {
  profileId?: string;
  contextType?: ChatContextType;
  cityName?: string;
  initialMessage?: string;
}

export interface ContinueChatRequest {
  sessionId: string;
  message: string;
  cityName?: string;
  contextType?: ChatContextType;
}

// ==================
// CHAT/LLM QUERIES
// ==================

// ==================
// ENHANCED CHAT SERVICES
// ==================

export const StartChat = async (request: StartChatRequest): Promise<NormalizedChatResponse> => {
  const endpoint = "loci.chat.ChatService/StartChat";
  await enforceRateLimit(endpoint);

  const response = await chatClient.startChat(
    create(StartChatRequestSchema, {
      cityName: request.cityName || "",
      contextType: toProtoDomainType(request.contextType),
      initialMessage: request.initialMessage || "",
    }),
  );

  return normalizeChatResponse(response, request.contextType);
};

export const ContinueChat = async (
  request: ContinueChatRequest,
): Promise<NormalizedChatResponse> => {
  const endpoint = "loci.chat.ChatService/ContinueChat";
  await enforceRateLimit(endpoint);

  const response = await chatClient.continueChat(
    create(ContinueChatRequestSchema, {
      sessionId: request.sessionId,
      message: request.message,
      cityName: request.cityName || "",
      contextType: toProtoDomainType(request.contextType),
    }),
  );

  return normalizeChatResponse(response, request.contextType);
};

// ==================
// MUTATION HOOKS FOR ENHANCED SERVICES
// ==================

export const useStartChatMutation = () => {
  return useMutation(() => ({
    mutationFn: StartChat,
  }));
};

export const useContinueChatMutation = () => {
  return useMutation(() => ({
    mutationFn: ContinueChat,
  }));
};

// GraphQL alternative to streaming service
// const PROCESS_UNIFIED_CHAT_MESSAGE = gql`
//   mutation ProcessUnifiedChatMessage($profileId: String!, $input: ChatMessageInput!) {
//     processUnifiedChatMessage(profileId: $profileId, input: $input) {
//       sessionId
//       success
//       error
//       events {
//         type
//         message
//         data
//         error
//         timestamp
//         eventId
//         isFinal
//         navigation {
//           url
//           routeType
//           queryParams
//         }
//       }
//     }
//   }
// `;

// Create GraphQL client instance
// const createAuthenticatedGraphQLClient = () => {
//   const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');

//   return createGraphQLClient(`${API_BASE_URL}/graphql`, {
//     headers: {
//       'Content-Type': 'application/json',
//       ...(token && { Authorization: `Bearer ${token}` }),
//     },
//   });
// };

// export const sendUnifiedChatMessageGraphQL = async (request: UnifiedChatStreamRequest): Promise<any> => {
//   console.log('=== GRAPHQL API CALL ===');
//   console.log('Request:', request);

//   const client = createAuthenticatedGraphQLClient();

//   try {
//     const result = await client(PROCESS_UNIFIED_CHAT_MESSAGE, {
//       profileId: request.profileId,
//       input: {
//         message: request.message,
//         userLocation: request.userLocation,
//       },
//     });

//     console.log('=== GRAPHQL RESPONSE ===');
//     console.log('Result:', result);
//     console.log('Result structure:', Object.keys(result || {}));

//     // Extract navigation data from events for redirect
//     const processResult = result?.data?.processUnifiedChatMessage;
//     console.log('processUnifiedChatMessage:', processResult);

//     const events = processResult?.events || [];
//     console.log('GraphQL Events count:', events.length);
//     console.log('First few events:', events.slice(0, 3));
//     console.log('Last few events:', events.slice(-3));

//     // Find navigation data in the complete event
//     const navigationEvent = events.find((event: any) => event.navigation && event.navigation.url);
//     if (navigationEvent) {
//       console.log('🧭 GraphQL Navigation found:', navigationEvent.navigation);

//       // Add navigation data to result for easy access
//       result.navigationData = navigationEvent.navigation;
//       console.log('✅ Navigation data added to result:', result.navigationData);
//     } else {
//       console.log('❌ No navigation event found');
//       // Debug: check if any events have navigation
//       const eventsWithNav = events.filter((event: any) => event.navigation);
//       console.log('Events with navigation field:', eventsWithNav);

//       // Additional debugging - check if result structure is different
//       console.log('Full result keys:', Object.keys(result || {}));
//       console.log('Result.data keys:', Object.keys(result?.data || {}));
//     }

//     return result;
//   } catch (error) {
//     console.error('GraphQL Error:', error);
//     throw error;
//   }
// };

// Domain detection utility (client-side)
export const detectDomain = (message: string): import("./types").DomainType => {
  const lowerMessage = message.toLowerCase();

  // Accommodation domain keywords
  if (
    /hotel|hostel|accommodation|stay|sleep|room|booking|airbnb|lodge|resort|guesthouse/.test(
      lowerMessage,
    )
  ) {
    return "accommodation";
  }

  // Dining domain keywords
  if (
    /restaurant|food|eat|dine|meal|cuisine|drink|cafe|bar|lunch|dinner|breakfast|brunch/.test(
      lowerMessage,
    )
  ) {
    return "dining";
  }

  // Activity domain keywords
  if (
    /activity|museum|park|attraction|tour|visit|see|do|experience|adventure|shopping|nightlife/.test(
      lowerMessage,
    )
  ) {
    return "activities";
  }

  // Itinerary domain keywords
  if (/itinerary|plan|schedule|trip|day|week|journey|route|organize|arrange/.test(lowerMessage)) {
    return "itinerary";
  }

  // Default to general domain
  return "general";
};

// ==================
// MUTATION HOOKS FOR UNIFIED CHAT
// ==================

// ==================
// CHAT SESSIONS RETRIEVAL
// ==================

export interface ChatSessionSummary {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messageCount: number;
  hasItinerary: boolean;
  lastMessage?: string;
  cityName?: string;
  performanceMetrics?: SessionPerformanceMetrics;
  contentMetrics?: SessionContentMetrics;
  engagementMetrics?: SessionEngagementMetrics;
  // Include full conversation data for loading sessions
  conversationHistory?: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}

// Get chat sessions for a user
const mapProtoChatSession = (session: ProtoChatSession): ChatSessionSummary => {
  const messages = session.conversationHistory.map((message) => ({
    id: message.id,
    type:
      message.role === MessageRole.USER
        ? "user"
        : message.role === MessageRole.SYSTEM
          ? "system"
          : "assistant",
    role:
      message.role === MessageRole.USER
        ? "user"
        : message.role === MessageRole.SYSTEM
          ? "system"
          : "assistant",
    content: message.content,
    timestamp: timestampToDate(message.timestamp),
  })) as ChatMessage[];
  const lastMessage = messages[messages.length - 1];

  return {
    id: session.id,
    title: session.cityName ? `Trip to ${session.cityName}` : "Chat session",
    preview: lastMessage?.content || "",
    timestamp: timestampToISOString(session.updatedAt || session.createdAt),
    messageCount: messages.length,
    hasItinerary: Boolean(session.currentItinerary),
    lastMessage: lastMessage?.content,
    cityName: session.cityName || undefined,
    conversationHistory: messages,
    created_at: timestampToISOString(session.createdAt),
    updated_at: timestampToISOString(session.updatedAt),
  };
};

export const getUserChatSessions = async (profileId: string): Promise<ChatSessionSummary[]> => {
  const response = await chatClient.getChatSessions({
    userId: profileId,
    pagination: {
      page: 1,
      pageSize: 25,
    },
  });
  return response.sessions.map(mapProtoChatSession);
};

/** Load a single chat session and return its saved itinerary payload, if any. */
export const getChatSession = async (sessionId: string): Promise<AiCityResponse | null> => {
  const response = await chatClient.getChatSession({ sessionId });
  return mapAiCityResponse(response.session?.currentItinerary) ?? null;
};

// Query hook for getting chat sessions
export const useGetChatSessionsQuery = (profileId: string | undefined) => {
  return {
    queryKey: ["chatSessions", profileId],
    queryFn: () => {
      if (!profileId) {
        return Promise.resolve([]);
      }
      return getUserChatSessions(profileId);
    },
    enabled: !!profileId,
  };
};
