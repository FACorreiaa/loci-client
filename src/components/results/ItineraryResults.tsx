import { GroundedBadge } from "../ui/GroundedBadge";
import { For, Show, createSignal } from "solid-js";
import {
  Star,
  MapPin,
  Clock,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-solid";
import FavoriteButton from "~/components/shared/FavoriteButton";
import WhyThisStop from "~/components/poi/WhyThisStop";
import { deriveWhyThis } from "~/lib/why-this";
import { POIDetailedInfo, AIItineraryResponse } from "~/lib/api/types";

interface ItineraryResultsProps {
  pois?: POIDetailedInfo[];
  itinerary?: AIItineraryResponse | null;
  compact?: boolean;
  limit?: number;
  showToggle?: boolean; // Whether to show the "Show More/Less" button
  initialLimit?: number; // Initial number to show before "Show More"
  onItemClick?: (poi: POIDetailedInfo) => void; // Callback for item clicks
  onFavoriteClick?: (poi: POIDetailedInfo) => void; // Callback for favorite button
  onShareClick?: (poi: POIDetailedInfo) => void; // Callback for share button
  favorites?: string[]; // Array of favorite POI IDs
  showAuthMessage?: boolean; // Whether to show auth message for non-authenticated users
  onToggleFavorite?: (poiId: string, poi: POIDetailedInfo) => void; // New callback for toggling favorites
  isLoadingFavorites?: boolean; // Loading state for favorites
}

export default function ItineraryResults(props: ItineraryResultsProps) {
  const [showAll, setShowAll] = createSignal(false);

  // Check if POI is in favorites
  const _isFavorite = (poiName: string) => {
    return props.favorites?.includes(poiName) || false;
  };

  const displayPOIs = () => {
    const pois = props.pois || props.itinerary?.points_of_interest || [];
    // Sort by priority if available
    const sortedPOIs = [...pois].sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // If a fixed limit is provided (from parent), use it
    if (props.limit && !props.showToggle) {
      return sortedPOIs.slice(0, props.limit);
    }

    // If showToggle is enabled, use initialLimit and showAll state
    if (props.showToggle) {
      const initialLimit = props.initialLimit || 5; // Higher default for POIs
      return showAll() ? sortedPOIs : sortedPOIs.slice(0, initialLimit);
    }

    // Default: show all
    return sortedPOIs;
  };

  const shouldShowToggle = () => {
    const pois = props.pois || props.itinerary?.points_of_interest || [];
    const initialLimit = props.initialLimit || 5;
    return props.showToggle && pois.length > initialLimit;
  };

  const getToggleText = () => {
    const pois = props.pois || props.itinerary?.points_of_interest || [];
    const initialLimit = props.initialLimit || 5;
    const remaining = pois.length - initialLimit;

    if (showAll()) {
      return "Show Less";
    } else {
      return `Show ${remaining} More`;
    }
  };

  const itineraryName = () => {
    const rawName = props.itinerary?.itinerary_name;
    if (!rawName) return "Custom Itinerary";

    // Handle case where itinerary_name might be a JSON string or object
    if (typeof rawName === "string" && rawName.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawName);
        return parsed.itinerary_name || parsed.name || "Custom Itinerary";
      } catch (e) {
        console.warn("Failed to parse itinerary name JSON:", e);
        return "Custom Itinerary";
      }
    }

    return rawName || "Custom Itinerary";
  };
  const description = () => props.itinerary?.overall_description;

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-destructive";
    if (priority === 2) return "bg-accent";
    if (priority === 3) return "bg-primary/80";
    return "bg-primary";
  };

  const getCategoryEmoji = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("museum")) return "🏛️";
    if (categoryLower.includes("park") || categoryLower.includes("garden")) return "🌳";
    if (categoryLower.includes("beach")) return "🏖️";
    if (categoryLower.includes("historic") || categoryLower.includes("castle")) return "🏰";
    if (categoryLower.includes("church") || categoryLower.includes("cathedral")) return "⛪";
    if (categoryLower.includes("market")) return "🛒";
    if (categoryLower.includes("restaurant") || categoryLower.includes("food")) return "🍽️";
    if (categoryLower.includes("viewpoint") || categoryLower.includes("lookout")) return "👁️";
    if (categoryLower.includes("landmark")) return "📍";
    if (categoryLower.includes("shopping")) return "🛍️";
    return "📍";
  };

  return (
    <div class="space-y-3">
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
            ✨
          </div>
          <h3 class="font-semibold text-foreground">
            {itineraryName()} ({displayPOIs().length} stops)
          </h3>
        </div>

        <Show when={description() && !props.compact}>
          <p class="text-sm text-muted-foreground leading-relaxed">{description()}</p>
        </Show>
      </div>

      <div class={props.compact ? "space-y-2" : "space-y-3"}>
        <For each={displayPOIs()}>
          {(poi, index) => (
            <div
              class={`rounded-lg border border-border ${
                props.compact
                  ? "p-3 bg-muted"
                  : "p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
              } ${props.onItemClick ? "cursor-pointer hover:bg-muted" : ""}`}
              onClick={() => props.onItemClick?.(poi)}
            >
              <div class="flex items-start gap-3">
                {/* Priority/Step Number */}
                <div class="flex-shrink-0 mt-1">
                  <Show
                    when={poi.priority}
                    fallback={
                      <div class="w-6 h-6 rounded-full bg-muted-foreground flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {index() + 1}
                      </div>
                    }
                  >
                    <div
                      class={`w-6 h-6 rounded-full ${getPriorityColor(poi.priority!)} flex items-center justify-center text-primary-foreground text-xs font-bold`}
                    >
                      {poi.priority}
                    </div>
                  </Show>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <h4
                          class={`font-medium text-foreground truncate ${
                            props.compact ? "text-sm" : "text-base"
                          }`}
                        >
                          {poi.name}
                        </h4>
                        <Show when={poi.category}>
                          <span class="text-sm" title={poi.category}>
                            {getCategoryEmoji(poi.category!)}
                          </span>
                        </Show>
                      </div>
                      <Show when={poi.category}>
                        <p class="text-xs text-muted-foreground">{poi.category}</p>
                      </Show>
                    </div>

                    <Show when={poi.rating}>
                      <div class="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Star class="w-4 h-4 text-accent fill-current" />
                        <span class="text-sm font-medium text-foreground">{poi.rating}</span>
                      </div>
                    </Show>
                  </div>

                  <Show when={!props.compact}>
                    <div class="mb-2">
                      <GroundedBadge grounded={poi.grounded} />
                    </div>
                  </Show>

                  <Show when={poi.description_poi && !props.compact}>
                    <p class="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {poi.description_poi}
                    </p>
                  </Show>

                  <Show when={!props.compact}>
                    <WhyThisStop
                      reason={deriveWhyThis({
                        category: poi.category,
                        rating: poi.rating,
                        recommendation_rationale: (
                          poi as POIDetailedInfo & {
                            recommendation_rationale?: string;
                          }
                        ).recommendation_rationale,
                        tags: poi.tags,
                      })}
                      uncertaintyScore={poi.uncertainty_score}
                      missingData={poi.missing_data}
                    />
                  </Show>

                  <div class="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <Show when={poi.distance}>
                      <div class="flex items-center gap-1">
                        <MapPin class="w-3 h-3" />
                        <span>{poi.distance}km away</span>
                      </div>
                    </Show>

                    <Show when={poi.time_to_spend}>
                      <div class="flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        <span>{poi.time_to_spend}</span>
                      </div>
                    </Show>

                    <Show when={poi.budget}>
                      <span class="text-primary font-medium">{poi.budget}</span>
                    </Show>

                    <Show when={poi.opening_hours && !props.compact}>
                      <div class="flex items-center gap-1">
                        <Calendar class="w-3 h-3" />
                        <span class="truncate">{poi.opening_hours}</span>
                      </div>
                    </Show>
                  </div>

                  {/* Action Buttons */}
                  <Show when={!props.compact}>
                    <div class="flex items-center gap-2 mt-3">
                      {/* Favorite Button */}
                      <FavoriteButton
                        item={{
                          id: poi.name,
                          name: poi.name,
                          contentType: "poi",
                          description: poi.description || "",
                          llmInteractionId: poi.llm_interaction_id,
                        }}
                        size="sm"
                        recommendationTrace={poi.recommendation_trace}
                        poiId={poi.id}
                      />

                      {/* Share Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (props.onShareClick) {
                            props.onShareClick(poi);
                          }
                        }}
                        disabled={!props.onShareClick}
                        class={`p-2 rounded-lg transition-colors ${
                          !props.onShareClick
                            ? "text-muted-foreground/50 cursor-not-allowed bg-muted"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        title={
                          props.onShareClick
                            ? "Share this place"
                            : props.showAuthMessage
                              ? "Sign in to share this place"
                              : "Share this place"
                        }
                      >
                        <Share2 class="w-4 h-4" />
                      </button>
                    </div>
                  </Show>

                  <Show when={poi.website && !props.compact}>
                    <div class="mt-3 pt-3 border-t border-border">
                      <a
                        href={poi.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Learn More <ChevronRight class="w-3 h-3" />
                      </a>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Show More/Less Toggle */}
      <Show when={shouldShowToggle()}>
        <div class="text-center py-3">
          <button
            onClick={() => setShowAll(!showAll())}
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg border border-primary/30 transition-colors"
          >
            <span>{getToggleText()}</span>
            {showAll() ? <ChevronUp class="w-4 h-4" /> : <ChevronDown class="w-4 h-4" />}
          </button>
        </div>
      </Show>

      {/* Status indicator when using fixed limit */}
      <Show
        when={
          props.limit &&
          !props.showToggle &&
          (props.pois?.length || props.itinerary?.points_of_interest?.length || 0) > props.limit
        }
      >
        <div class="text-center py-2">
          <span class="text-sm text-muted-foreground">
            Showing {props.limit} of{" "}
            {props.pois?.length || props.itinerary?.points_of_interest?.length || 0} places
          </span>
        </div>
      </Show>
    </div>
  );
}
