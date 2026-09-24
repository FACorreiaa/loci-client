import { Component, Show, createMemo } from "solid-js";
import { Heart, Share2, ChevronDown, ChevronUp } from "lucide-solid";
import { formatMessageContent } from "./format-message-content";
import ResultsList from "~/components/results/ResultsList";
import ItineraryStreamView from "~/components/itinerary/ItineraryStreamView";
import { stopsFromCityResponse } from "~/lib/itinerary/createItineraryStream";
import Markdown from "~/components/ui/Markdown";
import { ProactiveCaption } from "./ProactiveCaption";
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
        <ResultsList
          pois={props.streamingData.hotels}
          domain="hotels"
          cityName={props.streamingData.general_city_data?.city}
          limit={props.compact ? 3 : undefined}
          onSelect={(hotel) => props.onItemClick(hotel, "hotel")}
        />
      </Show>
      <Show when={props.streamingData.restaurants?.length > 0}>
        <ResultsList
          pois={props.streamingData.restaurants}
          domain="restaurants"
          cityName={props.streamingData.general_city_data?.city}
          limit={props.compact ? 3 : undefined}
          onSelect={(restaurant) => props.onItemClick(restaurant, "restaurant")}
        />
      </Show>
      <Show when={props.streamingData.activities?.length > 0}>
        <ResultsList
          pois={props.streamingData.activities}
          domain="activities"
          cityName={props.streamingData.general_city_data?.city}
          limit={props.compact ? 3 : undefined}
          onSelect={(activity) => props.onItemClick(activity, "activity")}
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
  // Posted by the agent on its own (standing task, briefing): same bubble,
  // captioned with where it came from.
  const proactiveLabel = () =>
    !isUser() && props.message.origin === "proactive"
      ? props.message.sourceLabel?.trim() || "From Loci"
      : null;

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

  // Muse bubbles (apps/_reviews/muse-chat-contract.md): no inline avatar and no
  // per-message name — the header carries who is speaking. Radius 24; the user
  // bubble is darkened coral with ink text, because white on it is 2.89:1.
  return (
    <div
      class={`flex ${isUser() ? "justify-end" : "justify-start"}`}
      data-testid="chat-message"
      data-role={isUser() ? "user" : "agent"}
      data-origin={proactiveLabel() ? "proactive" : "reply"}
    >
      <div class={isUser() ? "max-w-[85%]" : "max-w-[94%] min-w-0"}>
        <Show when={proactiveLabel()}>{(label) => <ProactiveCaption label={label()} />}</Show>
        <Show when={props.message.content.trim().length > 0 || !props.message.streaming}>
          <div
            data-testid="chat-bubble"
            class={`rounded-[24px] px-4 py-2.5 text-[15px] leading-normal ${
              isUser()
                ? "bg-[var(--muse-user-bubble)] text-[var(--muse-user-text)]"
                : isError()
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "bg-[var(--muse-agent-bubble)] text-[var(--muse-text)]"
            }`}
          >
            <Show
              when={!isUser() && !isError()}
              fallback={<div class="whitespace-pre-wrap">{displayText()}</div>}
            >
              <Markdown text={displayText()} />
            </Show>
          </div>
        </Show>

        <Show when={props.message.streamingData}>
          <div class="mt-2 rounded-2xl bg-[var(--muse-agent-bubble)] text-[var(--muse-text)] p-3 sm:p-4 motion-enter">
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
          class={`mt-1 px-2 text-xs text-[var(--muse-text-secondary)] ${isUser() ? "text-right" : ""}`}
        >
          {formatTimestamp(props.message.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
