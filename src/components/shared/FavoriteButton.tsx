import { Component, createMemo, Show } from "solid-js";
import { Heart, Loader2 } from "lucide-solid";
import { useFavoritesList, useToggleFavorite, type FavoriteItem } from "~/lib/api/favorites";
import { recordRecommendationEvents, type RecommendationTrace } from "~/lib/api/recommendations";

interface FavoriteButtonProps {
  item: FavoriteItem;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
  onClick?: (e: Event) => void;
  recommendationTrace?: RecommendationTrace;
  poiId?: string;
}

const FavoriteButton: Component<FavoriteButtonProps> = (props) => {
  const favoritesQuery = useFavoritesList();
  const { toggleFavorite, isLoading, getStableItemId } = useToggleFavorite();

  const isFavorited = createMemo(() => {
    const favorites = favoritesQuery.data;
    if (!favorites) return false;
    const stableId = getStableItemId(props.item);
    return favorites.items.includes(stableId);
  });

  const sizeClasses = () => {
    switch (props.size || "md") {
      case "sm":
        return "w-8 h-8";
      case "lg":
        return "w-12 h-12";
      default:
        return "w-10 h-10";
    }
  };

  const iconSizes = () => {
    switch (props.size || "md") {
      case "sm":
        return "w-4 h-4";
      case "lg":
        return "w-6 h-6";
      default:
        return "w-5 h-5";
    }
  };

  const handleClick = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.onClick) {
      props.onClick(e);
      return;
    }
    const wasFavorited = isFavorited();
    await toggleFavorite(props.item);
    if (!wasFavorited && props.recommendationTrace) {
      void recordRecommendationEvents([
        {
          eventType: "RECOMMENDATION_EVENT_TYPE_FAVORITED",
          trace: props.recommendationTrace,
          poiId: props.poiId || props.item.id,
        },
      ]);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading()}
      class={`
        ${sizeClasses()}
        flex items-center justify-center gap-2
        rounded-full transition-all duration-200
        ${
          isFavorited()
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-white/90 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        }
        backdrop-blur-sm shadow-lg
        border border-border
        disabled:opacity-50 disabled:cursor-not-allowed
        ${props.className || ""}
      `}
      title={isFavorited() ? "Remove from favorites" : "Add to favorites"}
    >
      <Show when={!isLoading()} fallback={<Loader2 class={`${iconSizes()} animate-spin`} />}>
        <Heart class={`${iconSizes()} ${isFavorited() ? "fill-current" : ""}`} />
      </Show>
      <Show when={props.showLabel}>
        <span class="text-sm font-medium">{isFavorited() ? "Favorited" : "Favorite"}</span>
      </Show>
    </button>
  );
};

export default FavoriteButton;
