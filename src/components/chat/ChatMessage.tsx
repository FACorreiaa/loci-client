import { Component, Show, createMemo } from "solid-js";
import { User, Heart, Share2, ChevronDown, ChevronUp } from "lucide-solid";
import { LociMark } from "~/components/brand/Logo";
import { formatMessageContent } from "./format-message-content";
import HotelResults from "~/components/results/HotelResults";
import RestaurantResults from "~/components/results/RestaurantResults";
import ActivityResults from "~/components/results/ActivityResults";
import ItineraryStreamView from "~/components/itinerary/ItineraryStreamView";
import { stopsFromCityResponse } from "~/lib/itinerary/createItineraryStream";
import Markdown from "~/components/ui/Markdown";
import type { ChatMessage as ChatMessageType } from "~/lib/hooks/useChat";

export interface ChatMessageProps {
  message: ChatMessageType;
  expanded: boolean;
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

// The tagged-payload-to-sentence logic lives in ./format-message-content so it
// can be unit tested without a DOM; re-exported here for callers that had it.
export { formatMessageContent };

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
        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
          <LociMark class="w-3 h-3 sm:w-4 sm:h-4" />
        </div>
      </Show>

      <div class={`max-w-[85%] sm:max-w-[70%] ${isUser() ? "order-1" : ""}`}>
        <Show when={!isUser()}>
          <p class="text-[11px] font-medium text-muted-foreground mb-1">Loci</p>
        </Show>
        <Show when={props.message.content.trim().length > 0 || !props.message.streaming}>
          <div
            class={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm ${
              isUser()
                ? "bg-primary text-primary-foreground shadow-primary/20"
                : isError()
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "loci-card text-foreground"
            }`}
          >
            <Show
              when={!isUser() && !isError()}
              fallback={<div class="text-sm whitespace-pre-wrap">{displayText()}</div>}
            >
              <Markdown text={displayText()} class="text-sm" />
            </Show>
          </div>
        </Show>

        <Show when={props.message.streamingData}>
          <div class="mt-2 sm:mt-3 loci-card rounded-xl p-3 sm:p-4 motion-enter">
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
                    class="p-1.5 sm:p-2 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg"
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
          class={`text-xs mt-1 sm:mt-2 ${isUser() ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}
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
