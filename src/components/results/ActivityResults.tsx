import { GroundedBadge } from "../ui/GroundedBadge";
import { For, Show, createSignal } from "solid-js";
import { Star, MapPin, Clock, DollarSign, Calendar, ChevronDown, ChevronUp } from "lucide-solid";

import { POIDetailedInfo } from "~/lib/api/types";

interface ActivityResultsProps {
  activities: POIDetailedInfo[];
  compact?: boolean;
  limit?: number;
  showToggle?: boolean; // Whether to show the "Show More/Less" button
  initialLimit?: number; // Initial number to show before "Show More"
  onItemClick?: (activity: POIDetailedInfo) => void; // Callback for item clicks
}

export default function ActivityResults(props: ActivityResultsProps) {
  const [showAll, setShowAll] = createSignal(false);

  const displayActivities = () => {
    const activities = props.activities || [];

    // If a fixed limit is provided (from parent), use it
    if (props.limit && !props.showToggle) {
      return activities.slice(0, props.limit);
    }

    // If showToggle is enabled, use initialLimit and showAll state
    if (props.showToggle) {
      const initialLimit = props.initialLimit || 3;
      return showAll() ? activities : activities.slice(0, initialLimit);
    }

    // Default: show all
    return activities;
  };

  const shouldShowToggle = () => {
    const activities = props.activities || [];
    const initialLimit = props.initialLimit || 3;
    return props.showToggle && activities.length > initialLimit;
  };

  const getToggleText = () => {
    const activities = props.activities || [];
    const initialLimit = props.initialLimit || 3;
    const remaining = activities.length - initialLimit;

    if (showAll()) {
      return "Show Less";
    } else {
      return `Show ${remaining} More`;
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.0) return "text-accent";
    if (rating >= 3.5) return "text-primary";
    return "text-muted-foreground";
  };

  const getBudgetColor = (_budget: string) => "text-primary";

  const getCategoryEmoji = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("museum")) return "🏛️";
    if (categoryLower.includes("park") || categoryLower.includes("garden")) return "🌳";
    if (categoryLower.includes("beach")) return "🏖️";
    if (categoryLower.includes("historic") || categoryLower.includes("castle")) return "🏰";
    if (categoryLower.includes("church") || categoryLower.includes("cathedral")) return "⛪";
    if (categoryLower.includes("market")) return "🛒";
    if (categoryLower.includes("art") || categoryLower.includes("gallery")) return "🎨";
    if (categoryLower.includes("music") || categoryLower.includes("concert")) return "🎵";
    if (categoryLower.includes("sport") || categoryLower.includes("stadium")) return "⚽";
    if (categoryLower.includes("shopping")) return "🛍️";
    if (categoryLower.includes("tour") || categoryLower.includes("walking")) return "🚶‍♂️";
    if (categoryLower.includes("viewpoint") || categoryLower.includes("lookout")) return "👁️";
    return "🎯";
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs">
          🎯
        </div>
        <h3 class="font-semibold text-foreground">Activities ({displayActivities().length})</h3>
      </div>

      <div class={props.compact ? "space-y-2" : "space-y-4"}>
        <For each={displayActivities()}>
          {(activity) => (
            <div
              class={`rounded-lg border border-border ${
                props.compact
                  ? "p-3 bg-muted"
                  : "p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
              } ${props.onItemClick ? "cursor-pointer hover:bg-muted" : ""}`}
              onClick={() => props.onItemClick?.(activity)}
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4
                      class={`font-medium text-foreground truncate ${
                        props.compact ? "text-sm" : "text-base"
                      }`}
                    >
                      {activity.name}
                    </h4>
                    <Show when={activity.category}>
                      <span class="text-sm" title={activity.category}>
                        {getCategoryEmoji(activity.category!)}
                      </span>
                    </Show>
                  </div>
                  <Show when={activity.category}>
                    <p class="text-xs text-muted-foreground">{activity.category}</p>
                  </Show>
                </div>

                <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                  <Show when={activity.rating}>
                    <div class="flex items-center gap-1">
                      <Star class={`w-3 h-3 fill-current ${getRatingColor(activity.rating!)}`} />
                      <span class={`text-xs font-medium ${getRatingColor(activity.rating!)}`}>
                        {activity.rating}
                      </span>
                    </div>
                  </Show>

                  <Show when={activity.budget || activity.price_range}>
                    <div class="flex items-center gap-1">
                      <DollarSign
                        class={`w-3 h-3 ${getBudgetColor(activity.budget || activity.price_range || "")}`}
                      />
                      <span
                        class={`text-xs font-medium ${getBudgetColor(activity.budget || activity.price_range || "")}`}
                      >
                        {activity.budget || activity.price_range}
                      </span>
                    </div>
                  </Show>
                </div>
              </div>

              <Show when={!props.compact}>
                <div class="mb-2">
                  <GroundedBadge grounded={activity.grounded} />
                </div>
              </Show>

              <Show when={activity.description_poi && !props.compact}>
                <p class="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {activity.description_poi}
                </p>
              </Show>

              <div class="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <Show when={activity.distance}>
                  <div class="flex items-center gap-1">
                    <MapPin class="w-3 h-3" />
                    <span>{activity.distance}km away</span>
                  </div>
                </Show>

                <Show when={activity.time_to_spend && !props.compact}>
                  <div class="flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    <span>{activity.time_to_spend}</span>
                  </div>
                </Show>

                <Show when={activity.opening_hours && !props.compact}>
                  <div class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    <span class="truncate">{activity.opening_hours}</span>
                  </div>
                </Show>

                <Show when={activity.address && !props.compact}>
                  <span class="truncate">{activity.address}</span>
                </Show>
              </div>

              <Show when={activity.website && !props.compact}>
                <div class="mt-3 pt-3 border-t border-border">
                  <a
                    href={activity.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Learn More →
                  </a>
                </div>
              </Show>
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
      <Show when={props.limit && !props.showToggle && props.activities.length > props.limit}>
        <div class="text-center py-2">
          <span class="text-sm text-muted-foreground">
            Showing {props.limit} of {props.activities.length} activities
          </span>
        </div>
      </Show>
    </div>
  );
}
