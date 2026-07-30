import { createSignal, createMemo, Show, onMount, For, lazy } from "solid-js";
import { MapPin, Navigation, Loader2, AlertCircle, ChevronDown } from "lucide-solid";
import { useChatRPC } from "~/lib/hooks/useChatRPC";
import { POIDetailedInfo } from "~/lib/api/types";
const MapComponent = lazy(() => import("~/components/features/Map/Map"));
import SplitView from "@/components/layout/SplitView";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import FloatingChat from "~/components/features/Chat/FloatingChat";
import { Skeleton } from "~/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { Badge } from "~/ui/badge";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { Button } from "~/ui/button";
import { useSelection, type SelectionItem } from "~/lib/hooks/useSelection";
import { SelectionToolbar } from "~/components/ui/SelectionToolbar";
import { exportPOIsToPDF } from "~/lib/utils/pdf-export";
import { StreamErrorCard } from "~/components/ui/StreamErrorCard";

// Distance options in kilometers
const DISTANCE_OPTIONS = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
];

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export default function NearmePage() {
  const { state, startStream } = useChatRPC();

  const [userLocation, setUserLocation] = createSignal<UserLocation | null>(null);
  const [locationError, setLocationError] = createSignal<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = createSignal(false);
  const [selectedDistance, setSelectedDistance] = createSignal(10); // Default 10km
  const [showDistanceDropdown, setShowDistanceDropdown] = createSignal(false);

  // Selection state for POIs
  const selection = useSelection<SelectionItem>();

  // Get user's location using Geolocation API
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLoadingLocation(false);
        // Automatically start search after getting location
        searchNearby(position.coords.latitude, position.coords.longitude, selectedDistance());
      },
      (error) => {
        setIsLoadingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("An unknown error occurred getting your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  // Search for nearby POIs
  const searchNearby = (lat: number, lon: number, distanceKm: number) => {
    const message = `Find places near me within ${distanceKm} kilometers. My location is at latitude ${lat.toFixed(6)} and longitude ${lon.toFixed(6)}. Show me restaurants, attractions, hotels, and activities nearby.`;

    startStream(message, "nearme", { latitude: lat, longitude: lon });
  };

  // Retry the last search. If we never got a fix, ask for location again -
  // otherwise the retry button would be a no-op on the one failure mode that
  // needs it most.
  const retrySearch = () => {
    const location = userLocation();
    if (location) {
      searchNearby(location.latitude, location.longitude, selectedDistance());
    } else {
      requestLocation();
    }
  };

  // Re-search with new distance
  const handleDistanceChange = (distance: number) => {
    setSelectedDistance(distance);
    setShowDistanceDropdown(false);
    const location = userLocation();
    if (location) {
      searchNearby(location.latitude, location.longitude, distance);
    }
  };

  // Request location on mount
  onMount(() => {
    requestLocation();
  });

  // Extract data from streamedData (same pattern as hotels/restaurants pages)
  const effectiveData = createMemo(() => state.streamedData);

  // Get all POIs from streamed data
  const allPois = createMemo((): POIDetailedInfo[] => {
    const data = effectiveData();
    if (!data) return [];

    const pois: POIDetailedInfo[] = [];

    // General POIs
    const generalPois = data.points_of_interest || data.general_pois || [];
    if (Array.isArray(generalPois)) {
      pois.push(
        ...generalPois.map((p: any) => ({
          ...p,
          category: p.category || "poi",
        })),
      );
    }

    // Restaurants
    const restaurants = data.restaurants || data.dining_response?.restaurants || [];
    if (Array.isArray(restaurants)) {
      pois.push(
        ...restaurants.map((r: any) => ({
          ...r,
          category: "restaurant",
        })),
      );
    }

    // Hotels
    const hotels = data.hotels || data.accommodation_response?.hotels || [];
    if (Array.isArray(hotels)) {
      pois.push(
        ...hotels.map((h: any) => ({
          ...h,
          category: "hotel",
        })),
      );
    }

    // Activities
    const activities = data.activities || data.activities_response?.activities || [];
    if (Array.isArray(activities)) {
      pois.push(
        ...activities.map((a: any) => ({
          ...a,
          category: "activity",
        })),
      );
    }

    return pois;
  });

  // Handlers
  const handleDownload = () => {
    const data = JSON.stringify({ pois: allPois(), location: userLocation() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nearme-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Places Near Me",
          text: `Found ${allPois().length} places nearby!`,
          url: window.location.href,
        })
        .catch(console.error);
    }
  };

  const handleBookmark = () => {
    console.log("Bookmark nearby results");
  };

  // Skeleton component
  const NearbyLoadingSkeleton = () => (
    <div class="space-y-4">
      <For each={[1, 2, 3, 4]}>
        {() => (
          <Card class="bg-card/80 backdrop-blur-sm border-border">
            <CardHeader>
              <Skeleton class="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton class="h-4 w-full mb-2" />
              <Skeleton class="h-4 w-2/3" />
            </CardContent>
          </Card>
        )}
      </For>
    </div>
  );

  // Map Content
  const MapContent = (
    <div class="relative h-full w-full">
      <Show
        when={allPois().length > 0}
        fallback={
          <div class="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {/* The error case must win: showing "grant location access" after a
                failed stream sent people back to a permission dialog they had
                already accepted. */}
            {state.error
              ? "Couldn't load nearby places — see the message on the left."
              : isLoadingLocation() || state.isStreaming
                ? "Getting your location and finding nearby places..."
                : "Grant location access to find places near you"}
          </div>
        }
      >
        <MapComponent
          center={[userLocation()?.longitude || 0, userLocation()?.latitude || 0]}
          pointsOfInterest={allPois()}
          zoom={13}
          fullBleed
        />
      </Show>

      {/* Floating Action Toolbar on Map */}
      <div class="absolute top-4 left-4 z-10">
        <ActionToolbar
          onDownload={handleDownload}
          onShare={handleShare}
          onBookmark={handleBookmark}
        />
      </div>
    </div>
  );

  // List Content
  const ListContent = (
    <div class="h-full overflow-y-auto p-4 md:p-6 bg-background">
      <div class="max-w-3xl mx-auto pb-20">
        {/* Location Header */}
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
              <Navigation class="w-6 h-6" />
            </div>
            <div>
              <h1 class="font-serif text-2xl font-bold text-foreground">Near Me</h1>
              <Show when={userLocation()}>
                <p class="text-sm text-muted-foreground">
                  {userLocation()?.latitude.toFixed(4)}, {userLocation()?.longitude.toFixed(4)}
                </p>
              </Show>
            </div>
          </div>

          {/* Distance Selector */}
          <div class="flex items-center gap-4 mb-4">
            <span class="text-sm text-muted-foreground">Search radius:</span>
            <div class="relative">
              <button
                onClick={() => setShowDistanceDropdown(!showDistanceDropdown())}
                class="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-all"
              >
                <MapPin class="w-4 h-4 text-primary" />
                <span class="font-medium text-foreground">{selectedDistance()} km</span>
                <ChevronDown class="w-4 h-4 text-muted-foreground" />
              </button>
              <Show when={showDistanceDropdown()}>
                <div class="absolute top-full left-0 mt-2 w-32 bg-card rounded-lg border border-border shadow-xl z-20">
                  <For each={DISTANCE_OPTIONS}>
                    {(option) => (
                      <button
                        onClick={() => handleDistanceChange(option.value)}
                        class={`w-full px-4 py-2 text-left hover:bg-muted first:rounded-t-lg last:rounded-b-lg ${
                          selectedDistance() === option.value
                            ? "bg-primary/10 text-primary"
                            : "text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <Show when={!userLocation() && !isLoadingLocation()}>
              <Button onClick={requestLocation} class="gap-2">
                <Navigation class="w-4 h-4" />
                Get My Location
              </Button>
            </Show>
          </div>
        </div>

        {/* Location Error */}
        <Show when={locationError()}>
          <div class="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-start gap-3">
            <AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">Location Access Required</p>
              <p class="text-sm opacity-90">{locationError()}</p>
              <button onClick={requestLocation} class="mt-2 text-sm underline hover:no-underline">
                Try again
              </button>
            </div>
          </div>
        </Show>

        {/* Loading State */}
        <Show when={isLoadingLocation()}>
          <div class="mb-6 p-6 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-4">
            <Loader2 class="w-6 h-6 animate-spin text-primary" />
            <div>
              <p class="font-medium text-primary">Getting your location...</p>
              <p class="text-sm text-muted-foreground opacity-80">This may take a few seconds</p>
            </div>
          </div>
        </Show>

        {/* Streaming State */}
        <Show when={state.isStreaming && !allPois().length}>
          <NearbyLoadingSkeleton />
        </Show>

        {/* Error State */}
        <Show when={state.error}>
          <StreamErrorCard
            error={state.error!}
            title="Unable to find nearby places"
            onRetry={retrySearch}
          />
        </Show>

        {/* Results */}
        <Show when={allPois().length > 0}>
          <div class="mb-8">
            <h3 class="font-serif text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <MapPin class="h-5 w-5 text-accent" />
              Nearby places ({allPois().length})
            </h3>
            <div class="space-y-4">
              <For each={allPois()}>
                {(item, index) => {
                  const itemForSelection: SelectionItem = {
                    id: item.name,
                    name: item.name,
                    category: item.category,
                    description: item.description_poi || item.description,
                    address: item.address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    rating: item.rating,
                  };
                  return (
                    <Card
                      class={`loci-card-interactive stagger-animation rounded-xl ${selection.isSelected(item.name) ? "ring-2 ring-accent border-accent/40" : ""}`}
                      style={{ "animation-delay": `${Math.min(index(), 19) * 0.05}s` }}
                    >
                      <CardHeader>
                        <div class="flex justify-between items-start">
                          <div class="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selection.isSelected(item.name)}
                              onChange={() => selection.toggleSelection(itemForSelection)}
                              class="w-4 h-4 text-primary rounded border-border focus:ring-primary flex-shrink-0"
                            />
                            <CardTitle class="text-lg">{item.name}</CardTitle>
                          </div>
                          <div class="flex items-center gap-2">
                            <FavoriteButton
                              item={{
                                id: item.name,
                                name: item.name,
                                contentType: "poi",
                                description: item.description_poi || item.description || "",
                              }}
                              size="sm"
                            />
                            <Badge variant="secondary">{item.category}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p class="text-sm text-muted-foreground line-clamp-3 mb-2">
                          {item.description_poi || item.description}
                        </p>
                        <div class="flex items-center gap-4 text-xs text-muted-foreground">
                          <Show when={item.distance}>
                            <span class="flex items-center gap-1">
                              <MapPin class="w-3 h-3" />
                              {typeof item.distance === "number"
                                ? `${(item.distance / 1000).toFixed(1)} km`
                                : item.distance}
                            </span>
                          </Show>
                          <Show when={item.address}>
                            <span class="truncate">{item.address}</span>
                          </Show>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Empty State */}
        <Show
          when={
            !isLoadingLocation() && !state.isStreaming && userLocation() && allPois().length === 0
          }
        >
          <div class="text-center py-12 text-muted-foreground">
            <MapPin class="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p class="text-lg font-medium">No places found nearby</p>
            <p class="text-sm">Try expanding your search radius</p>
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <>
      <SplitView mapContent={MapContent} listContent={ListContent} initialMode="map" />
      <FloatingChat />

      {/* Selection Toolbar */}
      <SelectionToolbar
        count={selection.count()}
        onExport={() => exportPOIsToPDF(selection.getSelectedItems())}
        onClear={() => selection.clearSelection()}
        onSelectAll={() => {
          const items = allPois().map((item) => ({
            id: item.name,
            name: item.name,
            category: item.category,
            description: item.description_poi || item.description,
            address: item.address,
            latitude: item.latitude,
            longitude: item.longitude,
            rating: item.rating,
          }));
          selection.selectAll(items);
        }}
      />
    </>
  );
}
