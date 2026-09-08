import { useLocale } from "~/contexts/LocaleContext";
import { For, Show, createSignal } from "solid-js";
import {
  Star,
  MapPin,
  Wifi,
  Car,
  Coffee,
  Utensils,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-solid";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { HotelDetailedInfo } from "~/lib/api/types";

interface HotelResultsProps {
  hotels: HotelDetailedInfo[];
  compact?: boolean;
  limit?: number;
  showToggle?: boolean; // Whether to show the "Show More/Less" button
  initialLimit?: number; // Initial number to show before "Show More"
  onItemClick?: (hotel: HotelDetailedInfo) => void; // Callback for item clicks
  onFavoriteClick?: (hotel: HotelDetailedInfo) => void; // Callback for favorite button
  onShareClick?: (hotel: HotelDetailedInfo) => void; // Callback for share button
  favorites?: string[]; // Array of favorite hotel IDs
}

export default function HotelResults(props: HotelResultsProps) {
  const locale = useLocale();
  const [showAll, setShowAll] = createSignal(false);

  const displayHotels = () => {
    const hotels = props.hotels || [];

    // If a fixed limit is provided (from parent), use it
    if (props.limit && !props.showToggle) {
      return hotels.slice(0, props.limit);
    }

    // If showToggle is enabled, use initialLimit and showAll state
    if (props.showToggle) {
      const initialLimit = props.initialLimit || 3;
      return showAll() ? hotels : hotels.slice(0, initialLimit);
    }

    // Default: show all
    return hotels;
  };

  const shouldShowToggle = () => {
    const hotels = props.hotels || [];
    const initialLimit = props.initialLimit || 3;
    return props.showToggle && hotels.length > initialLimit;
  };

  const getToggleText = () => {
    const hotels = props.hotels || [];
    const initialLimit = props.initialLimit || 3;
    const remaining = hotels.length - initialLimit;

    if (showAll()) {
      return "Show Less";
    } else {
      return `Show ${remaining} More`;
    }
  };

  const getAmenityIcon = (amenity: string) => {
    const amenityLower = amenity.toLowerCase();
    if (amenityLower.includes("wifi") || amenityLower.includes("internet"))
      return <Wifi class="w-3 h-3" />;
    if (amenityLower.includes("parking") || amenityLower.includes("car"))
      return <Car class="w-3 h-3" />;
    if (amenityLower.includes("breakfast") || amenityLower.includes("coffee"))
      return <Coffee class="w-3 h-3" />;
    if (amenityLower.includes("restaurant") || amenityLower.includes("dining"))
      return <Utensils class="w-3 h-3" />;
    return null;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.0) return "text-accent";
    if (rating >= 3.5) return "text-primary";
    return "text-muted-foreground";
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
          🏨
        </div>
        <h3 class="font-semibold text-foreground">Hotels ({displayHotels().length})</h3>
      </div>

      <div class={props.compact ? "space-y-2" : "space-y-4"}>
        <For each={displayHotels()}>
          {(hotel) => (
            <div
              class={`rounded-lg border border-border ${
                props.compact
                  ? "p-3 bg-muted"
                  : "p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
              } ${props.onItemClick ? "cursor-pointer hover:bg-muted" : ""}`}
              onClick={() => props.onItemClick?.(hotel)}
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <h4
                    class={`font-medium text-foreground truncate ${
                      props.compact ? "text-sm" : "text-base"
                    }`}
                  >
                    {hotel.name}
                  </h4>
                  <Show when={hotel.category}>
                    <p class="text-xs text-muted-foreground">{hotel.category}</p>
                  </Show>
                </div>

                <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                  <Show when={hotel.rating}>
                    <div class="flex items-center gap-1">
                      <Star class={`w-3 h-3 fill-current ${getRatingColor(hotel.rating!)}`} />
                      <span class={`text-xs font-medium ${getRatingColor(hotel.rating!)}`}>
                        {hotel.rating}
                      </span>
                    </div>
                  </Show>

                  <Show when={hotel.price_level}>
                    <span class="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                      {hotel.price_level}
                    </span>
                  </Show>
                </div>
              </div>

              <Show when={hotel.description && !props.compact}>
                <p class="text-sm text-muted-foreground mb-3 line-clamp-2">{hotel.description}</p>
              </Show>

              <div class="flex items-center gap-4 text-xs text-muted-foreground">
                <Show when={(hotel as any).distance}>
                  <div class="flex items-center gap-1">
                    <MapPin class="w-3 h-3" />
                    <span>{locale.formatDistance((hotel as any).distance)} away</span>
                  </div>
                </Show>

                <Show when={hotel.address && !props.compact}>
                  <span class="truncate">{hotel.address}</span>
                </Show>
              </div>

              <Show when={hotel.amenities && hotel.amenities.length > 0 && !props.compact}>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <For each={hotel.amenities.slice(0, 4)}>
                    {(amenity) => (
                      <div class="flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        {getAmenityIcon(amenity)}
                        <span>{amenity}</span>
                      </div>
                    )}
                  </For>
                  <Show when={hotel.amenities.length > 4}>
                    <span class="text-xs text-muted-foreground">
                      +{hotel.amenities.length - 4} more
                    </span>
                  </Show>
                </div>
              </Show>

              {/* Action Buttons */}
              <Show when={!props.compact}>
                <div class="flex items-center gap-2 mt-3">
                  <FavoriteButton
                    item={{
                      id: hotel.name,
                      name: hotel.name,
                      contentType: "hotel",
                      description: hotel.description || "",
                    }}
                    size="sm"
                    recommendationTrace={hotel.recommendation_trace}
                    poiId={hotel.id}
                  />
                  <Show when={props.onShareClick}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onShareClick?.(hotel);
                      }}
                      class="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Share this hotel"
                    >
                      <Share2 class="w-4 h-4" />
                    </button>
                  </Show>
                </div>
              </Show>

              <Show when={hotel.website && !props.compact}>
                <div class="mt-3 pt-3 border-t border-border">
                  <a
                    href={hotel.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Details →
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
      <Show when={props.limit && !props.showToggle && props.hotels.length > props.limit}>
        <div class="text-center py-2">
          <span class="text-sm text-muted-foreground">
            Showing {props.limit} of {props.hotels.length} hotels
          </span>
        </div>
      </Show>
    </div>
  );
}
