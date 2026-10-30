import { createSignal, Show, For, createEffect } from "solid-js";
import { Bot, Loader2, MapPin, Calendar, Clock, Star, Users, Heart } from "lucide-solid";
import { useStreamingChat } from "~/lib/hooks/useStreamingChat";
import type { DomainType } from "~/lib/api/types";

export interface StreamingChatMessageProps {
  url: string;
  requestBody: object;
  onComplete?: (response: any) => void;
  onRedirect?: (domain: DomainType, sessionId: string, city: string) => void;
}

export function StreamingChatMessage(props: StreamingChatMessageProps) {
  const [accumulatedData, setAccumulatedData] = createSignal<any>({});
  const [displayedResults, setDisplayedResults] = createSignal<any[]>([]);

  const { state, startStream, stopStream } = useStreamingChat({
    onProgress: (data) => {
      // Accumulate streaming data as it arrives
      if (data) {
        setAccumulatedData((prev) => ({
          ...prev,
          ...data,
        }));

        // Process and display partial results immediately
        processPartialData(data);
      }
    },
    onComplete: (response) => {
      props.onComplete?.(response);
    },
    onRedirect: (domain, sessionId, city) => {
      props.onRedirect?.(domain, sessionId, city);
    },
  });

  const processPartialData = (newData: any) => {
    const currentData = accumulatedData();
    const results = [];

    // Process city data
    if (newData.general_city_data || currentData.general_city_data) {
      const cityData = newData.general_city_data || currentData.general_city_data;
      if (cityData) {
        results.push({
          type: "city",
          title: `Exploring ${cityData.city}`,
          content: cityData.description || `Information about ${cityData.city}`,
          data: cityData,
          icon: MapPin,
        });
      }
    }

    // Process POIs as they stream in
    if (newData.points_of_interest || currentData.points_of_interest) {
      const pois = newData.points_of_interest || currentData.points_of_interest;
      if (pois && pois.length > 0) {
        results.push({
          type: "pois",
          title: `Found ${pois.length} points of interest`,
          content: `Discovered ${pois.length} interesting places for your trip`,
          data: pois,
          icon: Star,
        });
      }
    }

    // Process itinerary
    if (newData.itinerary_response || currentData.itinerary_response) {
      const itinerary = newData.itinerary_response || currentData.itinerary_response;
      if (itinerary) {
        results.push({
          type: "itinerary",
          title: itinerary.itinerary_name || "Your Itinerary",
          content: `Created a ${itinerary.duration_days || 1}-day itinerary`,
          data: itinerary,
          icon: Calendar,
        });
      }
    }

    // Process accommodations
    if (newData.accommodation_response || currentData.accommodation_response) {
      const hotels = newData.accommodation_response || currentData.accommodation_response;
      if (hotels && hotels.length > 0) {
        results.push({
          type: "hotels",
          title: `${hotels.length} accommodations found`,
          content: `Curated hotel recommendations for your stay`,
          data: hotels,
          icon: Heart,
        });
      }
    }

    // Process restaurants
    if (newData.dining_response || currentData.dining_response) {
      const restaurants = newData.dining_response || currentData.dining_response;
      if (restaurants && restaurants.length > 0) {
        results.push({
          type: "restaurants",
          title: `${restaurants.length} restaurants discovered`,
          content: `Handpicked dining experiences`,
          data: restaurants,
          icon: Users,
        });
      }
    }

    // Process activities
    if (newData.activities_response || currentData.activities_response) {
      const activities = newData.activities_response || currentData.activities_response;
      if (activities && activities.length > 0) {
        results.push({
          type: "activities",
          title: `${activities.length} activities available`,
          content: `Exciting activities for your adventure`,
          data: activities,
          icon: Clock,
        });
      }
    }

    setDisplayedResults(results);
  };

  // Start streaming when component mounts
  createEffect(() => {
    startStream(props.url, props.requestBody);
  });

  const currentState = state();

  return (
    <div class="streaming-chat-message">
      {/* Message header with bot avatar */}
      <div class="flex items-start gap-3 mb-4">
        <div class="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <Bot class="w-4 h-4 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-foreground mb-1">AI Assistant</div>

          {/* Streaming status */}
          <Show when={currentState.isStreaming}>
            <div class="flex items-center gap-2 text-sm text-primary mb-3">
              <Loader2 class="w-4 h-4 animate-spin" />
              <span>{currentState.currentStep}</span>
              <Show when={currentState.isConnected}>
                <div class="flex items-center gap-1">
                  <div class="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span class="text-xs text-success">Live</span>
                </div>
              </Show>
            </div>
          </Show>

          {/* Progress bar */}
          <Show when={currentState.isStreaming && currentState.progress > 0}>
            <div class="mb-4">
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentState.progress}%` }}
                />
              </div>
              <div class="text-xs text-muted-foreground mt-1">
                {Math.round(currentState.progress)}% complete
              </div>
            </div>
          </Show>

          {/* Error state */}
          <Show when={currentState.error}>
            <div class="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4">
              <p class="text-destructive text-sm font-medium">Error</p>
              <p class="text-destructive text-sm">{currentState.error}</p>
            </div>
          </Show>

          {/* Streaming results as they arrive */}
          <div class="space-y-3">
            <For each={displayedResults()}>
              {(result) => (
                <div class="bg-muted rounded-lg p-4 border border-border animate-fade-in">
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-8 h-8 bg-holo/10 rounded-lg flex items-center justify-center">
                      <result.icon class="w-4 h-4 text-primary" />
                    </div>
                    <div class="flex-1">
                      <h4 class="font-medium text-foreground mb-1">{result.title}</h4>
                      <p class="text-sm text-muted-foreground mb-2">{result.content}</p>

                      {/* Show partial data preview */}
                      <Show when={result.type === "pois" && result.data?.length > 0}>
                        <div class="space-y-1">
                          <For each={result.data.slice(0, 3)}>
                            {(poi: any) => (
                              <div class="text-xs text-muted-foreground bg-card rounded px-2 py-1">
                                <span class="font-medium">{poi.name}</span>
                                {poi.description && (
                                  <span class="ml-2">- {poi.description.substring(0, 50)}...</span>
                                )}
                              </div>
                            )}
                          </For>
                          <Show when={result.data.length > 3}>
                            <div class="text-xs text-primary font-medium">
                              +{result.data.length - 3} more places
                            </div>
                          </Show>
                        </div>
                      </Show>

                      <Show when={result.type === "city" && result.data?.city}>
                        <div class="text-xs text-muted-foreground bg-card rounded px-2 py-1">
                          📍 {result.data.city}
                          {result.data.country && `, ${result.data.country}`}
                        </div>
                      </Show>

                      <Show when={result.type === "itinerary" && result.data?.itinerary_name}>
                        <div class="text-xs text-muted-foreground bg-card rounded px-2 py-1">
                          📅 {result.data.itinerary_name}
                          {result.data.duration_days && ` (${result.data.duration_days} days)`}
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Completion message */}
          <Show
            when={!currentState.isStreaming && !currentState.error && displayedResults().length > 0}
          >
            <div class="mt-4 p-3 bg-success/10 border border-success/30 rounded-lg">
              <p class="text-sm text-success font-medium">
                ✓ Your travel plan is ready! Click on any section above to explore in detail.
              </p>
            </div>
          </Show>

          {/* Control buttons */}
          <Show when={currentState.isStreaming}>
            <div class="mt-4">
              <button
                onClick={stopStream}
                class="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:border-border"
              >
                Stop Generation
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

// Keyframe animation for fade-in effect
const styles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
