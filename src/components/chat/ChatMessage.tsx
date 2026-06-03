import { Component, Show, createMemo } from "solid-js";
import { Bot, User, Heart, Share2, ChevronDown, ChevronUp } from "lucide-solid";
import HotelResults from "~/components/results/HotelResults";
import RestaurantResults from "~/components/results/RestaurantResults";
import ActivityResults from "~/components/results/ActivityResults";
import ItineraryStreamView from "~/components/itinerary/ItineraryStreamView";
import { stopsFromCityResponse } from "~/lib/itinerary/createItineraryStream";
import { TypingAnimation } from "~/components/TypingAnimation";
import type { ChatMessage as ChatMessageType } from "~/lib/hooks/useChat";

export interface ChatMessageProps {
  message: ChatMessageType;
  expanded: boolean;
  /** Only the actively-streaming message should typewriter; history is static. */
  animate?: boolean;
  onToggle: (messageId: string) => void;
  onItemClick: (item: any, type: string) => void;
  onSave?: (message: ChatMessageType) => void;
  onShare?: (message: ChatMessageType) => void;
}

const formatTimestamp = (timestamp: any) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const PREFIX_PATTERNS = [
  /^\[city_data\]\s*/i,
  /^\[itinerary\]\s*/i,
  /^\[restaurants\]\s*/i,
  /^\[hotels\]\s*/i,
  /^\[activities\]\s*/i,
  /^\[pois\]\s*/i,
  /^\[general_pois\]\s*/i,
  /^\[personalized_pois\]\s*/i,
];

/** Strip LLM response prefixes / json fences and turn raw JSON payloads into a
 *  short human sentence. (Full markdown rendering is a later step.) */
const formatMessageContent = (content: string): string => {
  let cleaned = content.trim();
  for (const pattern of PREFIX_PATTERNS) cleaned = cleaned.replace(pattern, "");
  cleaned = cleaned.replace(/```json\s*(.*?)\s*```/s, "$1").trim();

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) return content;

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.city && parsed.country) {
      const details = [];
      if (parsed.description) details.push(parsed.description);
      if (parsed.population) details.push(`Population: ${parsed.population}`);
      if (parsed.weather) details.push(`Weather: ${parsed.weather}`);
      let result = `Let me tell you about ${parsed.city}, ${parsed.country}!`;
      if (details.length) result += ` ${details.join(". ")}.`;
      return result;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (first.name && first.category) {
        const type = first.cuisine_type ? "restaurants" : first.poi_type ? "attractions" : "places";
        return `I found ${parsed.length} great ${type} for you! Including ${first.name} and ${parsed.length - 1} more options.`;
      }
    }
    if (Array.isArray(parsed.points_of_interest)) {
      const count = parsed.points_of_interest.length;
      const first = parsed.points_of_interest[0]?.name || "some amazing places";
      return `I created a personalized itinerary with ${count} places to visit, including ${first} and more!`;
    }
    if (parsed.general_city_data) {
      const c = parsed.general_city_data;
      return `I found information about ${c.city}, ${c.country}. ${c.description || "Let me share the details with you!"}`;
    }
    return "I've prepared some personalized recommendations for you! Check out the details below.";
  } catch {
    return content;
  }
};

const StreamingResults: Component<{
  streamingData: any;
  messageId: string;
  compact: boolean;
  onItemClick: (item: any, type: string) => void;
}> = (props) => {
  const itineraryPois = () => props.streamingData.itinerary_response?.points_of_interest || [];
  const standalonePois = () => props.streamingData.points_of_interest || [];
  const hasDomainResults = () =>
    props.streamingData.hotels?.length > 0 ||
    props.streamingData.restaurants?.length > 0 ||
    props.streamingData.activities?.length > 0;
  const shouldRenderItinerary = () =>
    itineraryPois().length > 0 || (standalonePois().length > 0 && !hasDomainResults());

  return (
    <div class="space-y-4">
      <Show when={props.streamingData.hotels?.length > 0}>
        <HotelResults
          hotels={props.streamingData.hotels}
          compact={props.compact}
          showToggle={false}
          initialLimit={3}
          limit={props.compact ? 3 : undefined}
          onItemClick={(hotel: any) => props.onItemClick(hotel, "hotel")}
        />
      </Show>
      <Show when={props.streamingData.restaurants?.length > 0}>
        <RestaurantResults
          restaurants={props.streamingData.restaurants}
          compact={props.compact}
          showToggle={false}
          initialLimit={3}
          limit={props.compact ? 3 : undefined}
          onItemClick={(restaurant: any) => props.onItemClick(restaurant, "restaurant")}
        />
      </Show>
      <Show when={props.streamingData.activities?.length > 0}>
        <ActivityResults
          activities={props.streamingData.activities}
          compact={props.compact}
          showToggle={false}
          initialLimit={3}
          limit={props.compact ? 3 : undefined}
          onItemClick={(activity: any) => props.onItemClick(activity, "activity")}
        />
      </Show>
      <Show when={shouldRenderItinerary()}>
        {(() => {
          const model = stopsFromCityResponse(props.streamingData);
          const phase: "done" | "enriching" =
            model.enrichedCount >= model.stops.length ? "done" : "enriching";
          return (
            <ItineraryStreamView
              phase={phase}
              title={model.title}
              summary={model.summary}
              stops={model.stops}
              enrichedCount={model.enrichedCount}
              onStopClick={(s) => props.onItemClick({ name: s.name, id: s.placeId }, "poi")}
            />
          );
        })()}
      </Show>
    </div>
  );
};

const ChatMessage: Component<ChatMessageProps> = (props) => {
  const isUser = () => props.message.type === "user";
  const isError = () => props.message.type === "error";
  const displayText = createMemo(() => formatMessageContent(props.message.content));
  const cityData = () => props.message.streamingData?.general_city_data;

  const itineraryName = () => {
    const raw = props.message.streamingData?.itinerary_response?.itinerary_name;
    if (!raw) return `${cityData()?.city} Guide`;
    if (typeof raw === "string" && raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.itinerary_name || parsed.name || `${cityData()?.city} Guide`;
      } catch {
        return `${cityData()?.city} Guide`;
      }
    }
    if (typeof raw === "object" && raw?.itinerary_name) return raw.itinerary_name;
    return raw || `${cityData()?.city} Guide`;
  };

  return (
    <div class={`flex gap-2 sm:gap-3 ${isUser() ? "justify-end" : "justify-start"}`}>
      <Show when={!isUser()}>
        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-accent flex items-center justify-center flex-shrink-0">
          <Bot class="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        </div>
      </Show>

      <div class={`max-w-[85%] sm:max-w-[70%] ${isUser() ? "order-1" : ""}`}>
        <div
          class={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm ${
            isUser()
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20"
              : isError()
                ? "bg-red-50/80 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200/50 dark:border-red-800/50 backdrop-blur-sm"
                : "bg-card/80 text-foreground backdrop-blur-sm border border-border"
          }`}
        >
          <div class="text-sm whitespace-pre-wrap">
            <Show when={props.animate} fallback={<p>{displayText()}</p>}>
              <TypingAnimation text={displayText()} />
            </Show>
          </div>
        </div>

        <Show when={props.message.streamingData}>
          <div class="mt-2 sm:mt-3 bg-card/90 backdrop-blur-xl border border-border rounded-xl p-3 sm:p-4 shadow-lg shadow-gray-500/5 dark:shadow-black/20">
            <Show when={cityData()}>
              <div class="flex items-center justify-between mb-2 sm:mb-3">
                <div class="min-w-0 flex-1 pr-2">
                  <h4 class="font-semibold text-foreground text-sm sm:text-base truncate">
                    {itineraryName()}
                  </h4>
                  <p class="text-xs sm:text-sm text-muted-foreground truncate">
                    {cityData().city}, {cityData().country}
                  </p>
                </div>
                <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => props.onSave?.(props.message)}
                    class="p-1.5 sm:p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                    title="Save"
                  >
                    <Heart class="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => props.onShare?.(props.message)}
                    class="p-1.5 sm:p-2 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                    title="Share"
                  >
                    <Share2 class="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </Show>

            <StreamingResults
              streamingData={props.message.streamingData}
              messageId={props.message.id}
              compact={!props.expanded}
              onItemClick={props.onItemClick}
            />

            <Show when={props.message.showResults}>
              <button
                class="w-full mt-2 sm:mt-3 flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm text-primary hover:bg-primary/10 rounded-lg border border-primary/30 transition-colors"
                onClick={() => props.onToggle(props.message.id)}
              >
                <span>{props.expanded ? "Show Less" : "Show All Details"}</span>
                <Show
                  when={props.expanded}
                  fallback={<ChevronDown class="w-3 h-3 sm:w-4 sm:h-4" />}
                >
                  <ChevronUp class="w-3 h-3 sm:w-4 sm:h-4" />
                </Show>
              </button>
            </Show>
          </div>
        </Show>

        <p
          class={`text-xs mt-1 sm:mt-2 ${isUser() ? "text-blue-100 text-right" : "text-muted-foreground"}`}
        >
          {formatTimestamp(props.message.timestamp)}
        </p>
      </div>

      <Show when={isUser()}>
        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User class="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
        </div>
      </Show>
    </div>
  );
};

export default ChatMessage;
