import { createSignal, createEffect, Show, For, onMount, lazy } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  Search,
  MapPin,
  Star,
  Clock,
  Compass,
  Share2,
  Filter,
  SortAsc,
  SortDesc,
  Grid,
  X,
  Eye,
  Wifi,
  TriangleAlert,
  Map as MapIcon,
} from "lucide-solid";
const MapComponent = lazy(() => import("~/components/features/Map/Map"));
import {
  useNearbyPOIs,
  useFavorites,
  useAddToFavoritesMutation,
  useRemoveFromFavoritesMutation,
} from "~/lib/api/pois";
import type { ActivitiesResponse, POIDetailedInfo } from "~/lib/api/types";
import { useUserLocation } from "~/contexts/LocationContext";
import { TypingAnimation } from "~/components/TypingAnimation";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortBy, setSortBy] = createSignal("popularity"); // 'popularity', 'rating', 'distance', 'price'
  const [sortOrder, setSortOrder] = createSignal("desc");
  const [viewMode, setViewMode] = createSignal("map-cards"); // 'map-cards', 'cards', 'map'
  const [showFilters, setShowFilters] = createSignal(false);
  const [streamingData, setStreamingData] = createSignal<ActivitiesResponse | null>(null);
  const [fromChat, setFromChat] = createSignal(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = createSignal(false);
  const { userLocation } = useUserLocation() as any;
  const [searchRadius, setSearchRadius] = createSignal(10000);
  const location = useLocation();

  // API hooks
  const favoritesQuery = useFavorites();
  const addToFavoritesMutation = useAddToFavoritesMutation();
  const removeFromFavoritesMutation = useRemoveFromFavoritesMutation();

  // Get coordinates based on user location (discover is always location-based)
  const getSearchCoordinates = () => {
    const coords = {
      lat: userLocation()?.latitude || 38.7223,
      lon: userLocation()?.longitude || -9.1393,
    };
    console.log("📍 Using user/default coordinates:", coords);
    return coords;
  };

  const radiusOptions = [
    { value: 1000, label: "1 km" },
    { value: 5000, label: "5 km" },
    { value: 10000, label: "10 km" },
    { value: 25000, label: "25 km" },
    { value: 50000, label: "50 km" },
    { value: 75000, label: "75 km" },
    { value: 100000, label: "100 km" },
  ];

  // Initialize with streaming data on mount
  onMount(() => {
    console.log("=== DISCOVER PAGE MOUNT ===");
    console.log("Location state:", location.state);

    // Check for streaming data from route state
    if ((location.state as any)?.streamingData) {
      console.log("Found activities streaming data in route state");
      const data = (location.state as any).streamingData as ActivitiesResponse;
      setStreamingData(data);
      setFromChat(true);
      console.log("Received streaming data:", data);
    } else {
      console.log("No streaming data in route state, checking session storage");
      // Try to get data from session storage
      const storedSession = sessionStorage.getItem("completedStreamingSession");
      console.log("Session storage content:", storedSession);

      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          console.log("Parsed session:", session);

          if (session.data && session.data.activities) {
            console.log("Setting streaming data from session storage");
            setStreamingData(session.data as ActivitiesResponse);
            setFromChat(true);
            console.log("Loaded streaming data from session storage:", session.data);
          } else {
            console.log("No activities data found in session");
          }
        } catch (error) {
          console.error("Error parsing stored session:", error);
        }
      } else {
        console.log("No stored session found");
      }
    }
  });

  // Get POIs from appropriate source - note: useNearbyPOIs is stubbed, returns empty array
  const [poisData] = useNearbyPOIs();
  // Wrap in accessor for compatibility
  const pois = () => ({ loading: false, error: null as Error | null });
  const poisList = () => poisData() || [];

  console.log("📍 POIs loaded:", poisList().length);
  console.log("⭐ Favorites query state:", {
    data: favoritesQuery.data,
    isLoading: favoritesQuery.isLoading,
    error: favoritesQuery.error,
  });

  // Check if POI is in favorites
  const isFavorite = (poiId: string) => {
    const favs = (favoritesQuery.data as any[]) || [];
    const isInFavorites = favs.some((poi) => poi.id === poiId);
    console.log(`🔍 isFavorite(${poiId}): `, isInFavorites, "Favs:", favs);
    return isInFavorites;
  };

  const sortOptions = [
    { id: "popularity", label: "Popularity" },
    { id: "rating", label: "Rating" },
    { id: "distance", label: "Distance" },
    { id: "price", label: "Price" },
  ];

  // Get display location
  const displayLocation = () => {
    const streaming = streamingData();
    if (streaming && streaming.activities && streaming.activities.length > 0) {
      return streaming.activities[0].city || "Places";
    }

    return "Nearby Places";
  };

  // Filter and sort POIs
  const filteredPois = (): POIDetailedInfo[] => {
    const data = poisList();
    // If data is undefined or not an array, return an empty array
    if (!data || !Array.isArray(data)) {
      return [];
    }
    let filtered: POIDetailedInfo[] = data as unknown as POIDetailedInfo[];

    // Search filter
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(
        (poi) =>
          poi.name.toLowerCase().includes(query) ||
          (poi.description || "").toLowerCase().includes(query) ||
          (poi.tags || []).some((tag: string) => tag.toLowerCase().includes(query)),
      );
    }

    // Filter favorites
    if (showOnlyFavorites()) {
      filtered = filtered.filter((poi) => isFavorite(poi.id));
    }

    // Note: Category, Price, and Rating filters are now handled server-side in the API
    // Only search query is handled client-side for real-time filtering

    // Sort
    const currentSortBy = sortBy();
    const currentSortOrder = sortOrder();

    filtered = [...filtered].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (currentSortBy) {
        case "rating":
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case "distance":
          aVal = a.distance || 0;
          bVal = b.distance || 0;
          break;
        case "price": {
          const priceValues: Record<string, number> = { Free: 0, "€": 1, "€€": 2, "€€€": 3 };
          aVal = priceValues[a.price_level || ""] || 0;
          bVal = priceValues[b.price_level || ""] || 0;
          break;
        }
        case "popularity":
        default:
          aVal = a.reviewCount || 0;
          bVal = b.reviewCount || 0;
          break;
      }

      if (currentSortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  // const toggleFavorite = (poiId: string, poi?: POIDetailedInfo) => {
  //     const poiName = poi?.name || 'POI';

  //     console.log('🎯 Toggle favorite for POI:', { poiId, poiName, isFavorite: isFavorite(poiId) });
  //     console.log('📄 Full POI object:', poi);

  //     if (isFavorite(poiId)) {
  //         console.log('🗑️ Removing from favorites...');
  //         removeFromFavoritesMutation.mutate(poiId, {
  //             onSuccess: () => {
  //                 console.log(`✨ Removed ${ poiName } from favorites`);
  //                 // Add a brief visual effect
  //                 const button = document.querySelector(`[data - poi - id= "${poiId}"]`);
  //                 if (button) {
  //                     button.classList.add('animate-pulse');
  //                     setTimeout(() => button.classList.remove('animate-pulse'), 500);
  //                 }
  //             },
  //             onError: (error) => {
  //                 console.error('Failed to remove from favorites:', error);
  //             }
  //         });
  //     } else {
  //         console.log('⭐ Adding to favorites...');
  //         if (!poi) {
  //             console.error("Cannot add to favorites without POI data");
  //             return;
  //         }
  //         addToFavoritesMutation.mutate({ poiId, poiData: poi }, {
  //             onSuccess: () => {
  //                 console.log(`⭐ Added ${ poiName } to favorites`);
  //                 // Add a brief visual effect
  //                 const button = document.querySelector(`[data - poi - id= "${poiId}"]`);
  //                 if (button) {
  //                     button.classList.add('animate-bounce');
  //                     setTimeout(() => button.classList.remove('animate-bounce'), 600);
  //                 }
  //             },
  //             onError: (error) => {
  //                 console.error('Failed to add to favorites:', error);
  //             }
  //         });
  //     }
  // };

  const toggleFavorite = (poiId: string, poi?: POIDetailedInfo) => {
    if (isFavorite(poiId)) {
      removeFromFavoritesMutation.mutate({ poiId, poiData: poi });
    } else {
      if (!poi) return; // Ensure poi is provided for adding
      addToFavoritesMutation.mutate({ poiId, poiData: poi });
    }
  };

  // Handle POI item click for details view
  const handleItemClick = (poi: POIDetailedInfo) => {
    console.log("Viewing details for:", poi.name);
    // Navigate to POI details page or open modal
    // navigate(`/ poi / ${ poi.id } `);
  };

  // Handle sharing a POI
  const handleShare = (poi: POIDetailedInfo) => {
    if (navigator.share) {
      navigator
        .share({
          title: poi.name,
          text: `Check out ${poi.name} - ${poi.description} `,
          url: window.location.href + `? poi = ${poi.id} `,
        })
        .catch((err) => console.log("Error sharing:", err));
    } else {
      // Fallback to clipboard
      const shareText = `Check out ${poi.name}: ${poi.description} `;
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          // Show notification
          console.log("Copied to clipboard!");
        })
        .catch((err) => console.log("Failed to copy:", err));
    }
  };

  const getPriceColor = (_price?: string) => "text-primary bg-primary/10";

  const getPopularityInfo = (priority: number) => {
    if (priority >= 9) {
      return {
        label: "Trending",
        color: "text-destructive bg-destructive/10",
        icon: "🔥",
      };
    } else if (priority >= 7) {
      return {
        label: "Popular",
        color: "text-accent bg-accent/10",
        icon: "⭐",
      };
    } else if (priority >= 5) {
      return {
        label: "Liked",
        color: "text-primary bg-primary/10",
        icon: "👍",
      };
    } else if (priority >= 3) {
      return {
        label: "Rising",
        color: "text-muted-foreground bg-muted",
        icon: "📈",
      };
    }
    return null;
  };

  const getCategoryColor = (_category: string) => "text-primary bg-primary/10";

  const renderGridCard = (poi: POIDetailedInfo) => (
    <div class="bg-card rounded-lg shadow-sm border border-border overflow-hidden hover:shadow-md transition-all duration-200 group">
      {/* Image */}
      <div class="relative h-48 bg-muted/50 border-b border-border">
        <div class="absolute inset-0 flex items-center justify-center text-4xl">🏛️</div>

        {/* Badges */}
        <div class="absolute top-3 left-3 flex flex-col gap-1">
          <Show when={false}>
            <span class="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs font-medium">
              Featured
            </span>
          </Show>
          <Show when={true}>
            <span class="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
              Open Now
            </span>
          </Show>
        </div>

        {/* Action buttons */}
        <div class="absolute top-3 right-3 opacity-100 transition-opacity">
          <div class="flex flex-col gap-1">
            <button
              onClick={() => toggleFavorite(poi.id, poi)}
              disabled={addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending}
              data-poi-id={poi.id}
              class={`p-2 rounded-lg bg-card/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isFavorite(poi.id)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-accent hover:bg-muted"
              }`}
              title={isFavorite(poi.id) ? "Remove from favorites" : "Add to favorites"}
            >
              <Show
                when={!(addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending)}
                fallback={
                  <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                }
              >
                <Star class={`w-4 h-4 ${isFavorite(poi.id) ? "fill-current" : ""}`} />
              </Show>
            </button>
            <button
              onClick={() => handleShare(poi)}
              class="p-2 bg-card/90 text-muted-foreground rounded-lg shadow-sm hover:scale-110 hover:text-primary transition-all"
            >
              <Share2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rating badge */}
        <div class="absolute bottom-3 left-3">
          <div class="flex items-center gap-1 bg-card/90 rounded-full px-2 py-1 text-sm font-medium border border-border">
            <Star class="w-3 h-3 text-accent fill-current" />
            <span class="text-foreground">{poi.rating || 0}</span>
            <span class="text-muted-foreground">({poi.reviewCount || 0})</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="p-4">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-foreground text-base mb-1 truncate">{poi.name}</h3>
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span
                class={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(poi.category)}`}
              >
                {poi.category}
              </span>
              <Show when={poi.priority && getPopularityInfo(poi.priority)}>
                {(() => {
                  const popularityInfo = getPopularityInfo(poi.priority!);
                  return (
                    <Show when={popularityInfo}>
                      <span
                        class={`px-2 py-0.5 rounded-full text-xs font-medium ${popularityInfo!.color}`}
                      >
                        <span class="mr-1">{popularityInfo!.icon}</span>
                        {popularityInfo!.label}
                      </span>
                    </Show>
                  );
                })()}
              </Show>
              <Show when={poi.time_to_spend}>
                <span class="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                  {poi.time_to_spend}
                </span>
              </Show>
            </div>
            <p class="text-sm text-muted-foreground">{poi.city}</p>
          </div>
          <span
            class={`px-2 py-1 rounded-full text-xs font-medium ${getPriceColor(poi.price_level)}`}
          >
            {poi.price_level}
          </span>
        </div>

        <p class="text-sm text-muted-foreground mb-3 line-clamp-2">{poi.description}</p>

        {/* Details */}
        <div class="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <div class="flex items-center gap-1">
            <MapPin class="w-3 h-3" />
            <span>{poi.distance}</span>
          </div>
          <Show when={poi.amenities && poi.amenities.length > 0}>
            <div class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              <span>{poi.amenities![0]}</span>
            </div>
          </Show>
        </div>

        {/* Tags */}
        <div class="flex flex-wrap gap-1 mb-3">
          <For each={(poi.tags || []).slice(0, 3)}>
            {(tag) => (
              <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{tag}</span>
            )}
          </For>
          {(poi.tags || []).length > 3 && (
            <span class="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
              +{(poi.tags || []).length - 3}
            </span>
          )}
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm">
            <Show when={poi.amenities && poi.amenities.includes("Wifi")}>
              <Wifi class="w-4 h-4 text-muted-foreground" />
            </Show>
            <Show when={poi.amenities && poi.amenities.includes("Parking")}>
              <MapPin class="w-4 h-4 text-muted-foreground" />
            </Show>
          </div>
          <button
            onClick={() => handleItemClick(poi)}
            class="text-primary hover:text-primary/80 font-medium text-sm"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  );

  createEffect(() => {
    console.log("Search radius changed to:", searchRadius());
  });

  const renderListItem = (poi: POIDetailedInfo) => (
    <div class="bg-card rounded-lg shadow-sm border border-border p-4 hover:shadow-md transition-all duration-200">
      <div class="flex gap-4">
        {/* Image */}
        <div class="w-24 h-24 bg-muted/50 border border-border rounded-lg flex items-center justify-center flex-shrink-0">
          🏛️
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-foreground text-lg">{poi.name}</h3>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span
                  class={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(poi.category)}`}
                >
                  {poi.category}
                </span>
                <Show when={poi.priority && getPopularityInfo(poi.priority)}>
                  {(() => {
                    const popularityInfo = getPopularityInfo(poi.priority!);
                    return (
                      <Show when={popularityInfo}>
                        <span
                          class={`px-2 py-0.5 rounded-full text-xs font-medium ${popularityInfo!.color}`}
                        >
                          <span class="mr-1">{popularityInfo!.icon}</span>
                          {popularityInfo!.label}
                        </span>
                      </Show>
                    );
                  })()}
                </Show>
                <Show when={poi.time_to_spend}>
                  <span class="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                    {poi.time_to_spend}
                  </span>
                </Show>
              </div>
              <p class="text-sm text-muted-foreground">{poi.city}</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <Star class="w-4 h-4 text-accent fill-current" />
                <span class="text-sm font-medium text-foreground">{poi.rating || 0}</span>
                <span class="text-sm text-muted-foreground">({poi.reviewCount || 0})</span>
              </div>
              <span
                class={`px-2 py-1 rounded-full text-xs font-medium ${getPriceColor(poi.price_level)}`}
              >
                {poi.price_level}
              </span>
            </div>
          </div>

          <p class="text-muted-foreground mb-3">{poi.description}</p>

          <div class="flex items-center justify-between">
            <div class="flex flex-wrap gap-1">
              <For each={(poi.tags || []).slice(0, 4)}>
                {(tag) => (
                  <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                    {tag}
                  </span>
                )}
              </For>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(poi.id, poi)}
                disabled={addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending}
                data-poi-id={poi.id}
                class={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isFavorite(poi.id)
                    ? "text-accent"
                    : "text-muted-foreground hover:text-accent hover:bg-muted"
                }`}
                title={isFavorite(poi.id) ? "Remove from favorites" : "Add to favorites"}
              >
                <Show
                  when={
                    !(addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending)
                  }
                  fallback={
                    <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  }
                >
                  <Star class={`w-4 h-4 ${isFavorite(poi.id) ? "fill-current" : ""}`} />
                </Show>
              </button>
              <button
                onClick={() => handleShare(poi)}
                class="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                title="Share this place"
              >
                <Share2 class="w-4 h-4" />
              </button>
              <button
                onClick={() => handleItemClick(poi)}
                class="text-primary hover:text-primary/80 font-medium text-sm"
              >
                <Eye class="w-4 h-4 inline mr-1" />
                Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div class="min-h-screen relative transition-colors">
      {/* Chat Success Banner */}
      <Show when={fromChat()}>
        <div class="px-4 py-3 sm:px-6">
          <div class="max-w-7xl mx-auto">
            <div class="flex items-center gap-3 glass-panel gradient-border rounded-xl p-3">
              <div class="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground shadow">
                <Compass class="w-4 h-4" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-foreground">
                  ✨ <TypingAnimation text="Your activity recommendations are ready!" />
                </p>
                <p class="text-xs text-muted-foreground">
                  Generated from your chat: "
                  {(location.state as any)?.originalMessage || "Activity search"}"
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFromChat(false)}>
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Header */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="loci-hero">
          <div class="loci-hero__content p-6 sm:p-8 flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="loci-chip uppercase tracking-wide text-[10px] sm:text-xs">
                    Discover
                  </span>
                  <Show when={showOnlyFavorites()}>
                    <span class="loci-chip loci-chip--muted">Favorites only</span>
                  </Show>
                </div>
                <h1 class="text-3xl sm:text-4xl font-bold leading-tight">
                  Near Me · {displayLocation()}
                </h1>
                <p class="loci-hero__subtitle">
                  {pois().loading
                    ? "Finding great spots around you..."
                    : `${filteredPois().length} places curated to your vibe`}
                </p>
                <div class="flex flex-wrap gap-2 text-sm">
                  <span class="loci-chip">
                    <Compass class="w-4 h-4" />
                    {searchRadius() / 1000} km radius
                  </span>
                  <Show when={favoritesQuery.data}>
                    <span class="loci-chip">
                      <Star class="w-4 h-4" />
                      {favoritesQuery.data?.length || 0} saved
                    </span>
                  </Show>
                  <Show when={pois().error}>
                    <span class="loci-chip loci-chip--destructive">
                      <TriangleAlert class="w-4 h-4" />
                      {pois().error?.message || "Error loading POIs"}
                    </span>
                  </Show>
                </div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full sm:w-auto">
                <div class="loci-hero__stat">
                  <div class="loci-hero__stat-label">Spots</div>
                  <div class="text-2xl font-bold">{filteredPois().length}</div>
                  <div class="loci-hero__stat-detail">Matched to filters</div>
                </div>
                <div class="loci-hero__stat">
                  <div class="loci-hero__stat-label">Favorites</div>
                  <div class="text-2xl font-bold">{favoritesQuery.data?.length || 0}</div>
                  <div class="loci-hero__stat-detail">Saved nearby</div>
                </div>
                <div class="loci-hero__stat col-span-2 sm:col-span-1">
                  <div class="loci-hero__stat-label">View</div>
                  <div class="text-sm font-semibold capitalize">
                    {viewMode().replace("-", " + ")}
                  </div>
                  <div class="loci-hero__stat-detail">Map / Cards</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Controls */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex flex-col gap-4">
            {/* Top row: Search */}
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Search */}
              <div class="relative flex-1 max-w-md">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <TextFieldRoot class="w-full">
                  <TextField
                    type="text"
                    placeholder="Search places..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    class="pl-10"
                  />
                </TextFieldRoot>
              </div>

              {/* Mobile controls toggle */}
              <div class="flex items-center gap-2 sm:hidden">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters())}
                  class="gap-2"
                >
                  <Filter class="w-4 h-4" />
                  Controls
                </Button>
              </div>
            </div>

            {/* Controls - Always visible on desktop, collapsible on mobile */}
            <div class={`${showFilters() ? "block" : "hidden"} sm: block`}>
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left side: Primary controls */}
                <div class="flex flex-wrap items-center gap-4">
                  {/* Radius Selection */}
                  <div class="flex items-center gap-2">
                    <label
                      for="radius-select"
                      class="text-sm font-medium text-foreground whitespace-nowrap"
                    >
                      Search Radius:
                    </label>
                    <select
                      id="radius-select"
                      value={searchRadius()}
                      onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                      class="min-w-[100px] px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                    >
                      <For each={radiusOptions}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </div>

                  {/* Favorites Filter */}
                  <div class="flex items-center gap-2">
                    <button
                      onClick={() => setShowOnlyFavorites(!showOnlyFavorites())}
                      class={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                        showOnlyFavorites()
                          ? "bg-accent/10 border-accent/30 text-accent"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Star class={`w-4 h-4 ${showOnlyFavorites() ? "fill-current" : ""}`} />
                      <span class="hidden sm:inline">
                        {showOnlyFavorites() ? "Show All" : "Favorites Only"}
                      </span>
                      <span class="sm:hidden">⭐</span>
                    </button>
                  </div>

                  {/* Sort Controls */}
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-foreground whitespace-nowrap">
                      Sort by:
                    </label>
                    <div class="flex items-center gap-1">
                      <select
                        value={sortBy()}
                        onChange={(e) => setSortBy(e.target.value)}
                        class="min-w-[120px] px-3 py-2 border border-border rounded-l-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                      >
                        <For each={sortOptions}>
                          {(option) => <option value={option.id}>{option.label}</option>}
                        </For>
                      </select>
                      <button
                        onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                        class="p-2 border border-l-0 border-border rounded-r-lg hover:bg-muted bg-card transition-colors"
                        title={`Sort ${sortOrder() === "asc" ? "Descending" : "Ascending"} `}
                      >
                        {sortOrder() === "asc" ? (
                          <SortAsc class="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <SortDesc class="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right side: View mode toggle */}
                <div class="flex items-center gap-2">
                  <label class="text-sm font-medium text-foreground whitespace-nowrap">
                    View:
                  </label>
                  <div class="flex items-center border border-border rounded-lg p-1 bg-card">
                    <button
                      onClick={() => setViewMode("map-cards")}
                      class={`p-2 rounded transition-colors ${viewMode() === "map-cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      title="Split view: Map + Cards"
                    >
                      <div class="flex items-center gap-1">
                        <MapIcon class="w-3 h-3" />
                        <Grid class="w-3 h-3" />
                      </div>
                    </button>
                    <button
                      onClick={() => setViewMode("cards")}
                      class={`p-2 rounded transition-colors ${viewMode() === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      title="Show only cards"
                    >
                      <Grid class="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("map")}
                      class={`p-2 rounded transition-colors ${viewMode() === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      title="Show only map"
                    >
                      <MapIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between mb-6">
          <p class="text-muted-foreground">
            {filteredPois().length} place{filteredPois().length !== 1 ? "s" : ""} found
          </p>
        </div>

        <Show
          when={filteredPois().length > 0}
          fallback={
            <div class="text-center py-12">
              <Search class="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 class="text-lg font-semibold text-foreground mb-2">No places found</h3>
              <p class="text-muted-foreground">
                Try adjusting your search criteria or filters
              </p>
            </div>
          }
        >
          {/* Map + Cards View */}
          <Show when={viewMode() === "map-cards"}>
            <div class="flex flex-col lg:flex-row gap-6 h-[700px]">
              {/* Map Section */}
              <div class="w-full lg:w-1/2 h-full rounded-lg overflow-hidden border border-border">
                <MapComponent
                  center={[getSearchCoordinates().lon, getSearchCoordinates().lat]}
                  zoom={12}
                  pointsOfInterest={filteredPois()}
                />
              </div>

              {/* Cards Section */}
              <div class="w-full lg:w-1/2 h-full overflow-y-auto">
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 pr-2">
                  <For each={filteredPois()}>{(poi) => renderListItem(poi)}</For>
                </div>
              </div>
            </div>
          </Show>

          {/* Cards Only View */}
          <Show when={viewMode() === "cards"}>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <For each={filteredPois()}>{(poi) => renderGridCard(poi)}</For>
            </div>
          </Show>

          {/* Map Only View */}
          <Show when={viewMode() === "map"}>
            <div class="h-[700px] w-full rounded-lg overflow-hidden border border-border">
              <MapComponent
                center={[getSearchCoordinates().lon, getSearchCoordinates().lat]}
                zoom={12}
                pointsOfInterest={filteredPois()}
              />
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
