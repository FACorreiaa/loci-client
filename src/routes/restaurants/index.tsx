import { createSignal, createMemo, Show, onMount, lazy } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useChatRPC } from "~/lib/hooks/useChatRPC";
import { hasListContent, readCompletedSession } from "~/lib/streaming/restore-session";
import { useLiveSession } from "~/lib/streaming/live-stream-store";
import { resumeLiveSession } from "~/lib/streaming/resume-live";
import { POIDetailedInfo } from "~/lib/api/types";
import RestaurantResults from "~/components/results/RestaurantResults";
const MapComponent = lazy(() => import("~/components/features/Map/Map"));
import SplitView from "@/components/layout/SplitView";
import { CityInfoHeader } from "@/components/ui/CityInfoHeader";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import FloatingChat from "~/components/features/Chat/FloatingChat";
import { Skeleton } from "~/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/ui/card";
import { StreamErrorCard } from "~/components/ui/StreamErrorCard";

export default function RestaurantsPage() {
  const [searchParams] = useSearchParams();
  // No defaults. These used to fall back to a generic query and "London", so a
  // lost session id — which happens whenever a payload-less COMPLETE frame maps
  // sessionId to "" — silently streamed London to somebody who had asked about
  // somewhere else. An absent query is an error, not a different city.
  const [message] = createSignal((searchParams.message as string) || "");
  const [cityName] = createSignal((searchParams.cityName as string) || "");

  const { state, startStream, setError } = useChatRPC();

  const [restoredData, setRestoredData] = createSignal<any>(null);
  // A search started on `/` streams on the service singleton; when its
  // session is the one in the URL, read it live (see live-stream-store.ts).
  const live = useLiveSession(() => searchParams.sessionId as string | undefined);
  const [boundLive, setBoundLive] = createSignal(false);

  // Local favorites state
  const [favorites, setFavorites] = createSignal<string[]>([]);

  // A payload with neither results nor city data is not a restore. The guard
  // used to be `if (!data)`, and `{}` is truthy, so an empty stream counted as
  // success and the panel shimmered forever with nothing in flight.
  const normalizeStoredData = (data: any): any => {
    if (!data) return null;
    const normalized: any = { ...data };

    if (Array.isArray(data.restaurants)) {
      normalized.restaurants = data.restaurants;
    } else if (data.dining_response?.restaurants) {
      normalized.restaurants = data.dining_response.restaurants;
      if (data.dining_response.general_city_data) {
        normalized.general_city_data = data.dining_response.general_city_data;
      }
    }

    if (!hasListContent(normalized, "restaurants")) return null;
    return normalized;
  };

  // startOrExplain is both the mount path and the retry path, so Retry does
  // the same thing arriving on the page does.
  const startOrExplain = () => {
    if (!message().trim() || !cityName().trim()) {
      setError("Tell Loci what you're looking for and where. Try a search to start.");
      return;
    }
    startStream(message(), cityName());
  };

  onMount(() => {
    const sessionIdFromUrl = searchParams.sessionId as string;

    if (sessionIdFromUrl) {
      if (resumeLiveSession(sessionIdFromUrl)) {
        setBoundLive(true);
        return;
      }
      const restored = normalizeStoredData(readCompletedSession(sessionIdFromUrl));
      if (restored) {
        setRestoredData(restored);
        return;
      }
      // The session id restores nothing — a different search, an empty
      // payload, or storage cleared. This used to be a bare `return`: no
      // fetch, no error, no loading flag, and a permanently empty panel. Re-run
      // the search when we still know what was asked, and say so when we don't.
    }

    if (!state.isConnected) {
      startOrExplain();
    }
  });

  const liveData = createMemo(() => (boundLive() ? live.data() : null));
  const effectiveData = createMemo(() => restoredData() || liveData() || state.streamedData);
  const isStreaming = () => (boundLive() ? live.isStreaming() : state.isStreaming);
  const streamError = () => (boundLive() ? live.error() : state.error);
  const cityData = createMemo(() => effectiveData()?.general_city_data);

  const restaurants = createMemo(() => {
    const data = effectiveData();
    if (!data) return [];
    const list =
      data.restaurants || data.dining_response?.restaurants || data.points_of_interest || [];
    return Array.isArray(list) ? list : [];
  });

  const allPois = createMemo(() => {
    return restaurants().map((r) => ({
      ...r,
      id: r.name,
      latitude: typeof r.latitude === "string" ? parseFloat(r.latitude) : r.latitude,
      longitude: typeof r.longitude === "string" ? parseFloat(r.longitude) : r.longitude,
    })) as unknown as POIDetailedInfo[];
  });

  const handleDownload = () => {
    const data = JSON.stringify(effectiveData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restaurants-${cityName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Restaurants in ${cityName()}`,
          text: `Check out these restaurants in ${cityName()}!`,
          url: window.location.href,
        })
        .catch(console.error);
    }
  };

  const handleBookmark = () => {
    console.log("Bookmark restaurants list");
  };

  const handleItemFavorite = (restaurant: any) => {
    const name = restaurant.name;
    setFavorites((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    console.log(`Toggled favorite for: ${name}`);
  };

  const MapContent = (
    <div class="h-full w-full bg-muted relative">
      <Show
        when={allPois().length > 0}
        fallback={
          <div class="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {isStreaming() ? "Loading map data..." : "No items to display on map"}
          </div>
        }
      >
        <MapComponent
          center={[
            (allPois()[0]?.longitude as number) || 0,
            (allPois()[0]?.latitude as number) || 0,
          ]}
          pointsOfInterest={allPois()}
          zoom={12}
        />
      </Show>

      <div class="absolute top-4 left-4 z-10">
        <ActionToolbar
          onDownload={handleDownload}
          onShare={handleShare}
          onBookmark={handleBookmark}
        />
      </div>
    </div>
  );

  const ListContent = (
    <div class="h-full overflow-y-auto p-4 md:p-6 bg-background/50 backdrop-blur-sm">
      <div class="max-w-3xl mx-auto pb-20">
        <CityInfoHeader cityData={cityData()} isLoading={isStreaming() && !cityData()} />

        <Show when={streamError()}>
          <StreamErrorCard
            error={streamError()!}
            title="Unable to load restaurants"
            onRetry={startOrExplain}
          />
        </Show>

        <Show when={isStreaming() && !restaurants().length}>
          <RestaurantsSkeleton />
        </Show>

        <Show when={restaurants().length > 0}>
          <div class="mb-8">
            <h3 class="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <span class="text-2xl">🍽️</span> Restaurants ({restaurants().length})
            </h3>
            <RestaurantResults
              restaurants={restaurants()}
              onFavoriteClick={handleItemFavorite}
              favorites={favorites()}
            />
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <>
      <SplitView listContent={ListContent} mapContent={MapContent} initialMode="split" />
      <FloatingChat
        getStreamingData={() => effectiveData()}
        setStreamingData={(fn) => {
          const currentData = effectiveData();
          const newData = typeof fn === "function" ? fn(currentData) : fn;
          setRestoredData(newData);
        }}
        initialSessionId={searchParams.sessionId as string}
      />
    </>
  );
}

function RestaurantsSkeleton() {
  return (
    <div class="space-y-6">
      <div class="rounded-2xl bg-muted h-64 animate-pulse" />
      <div class="space-y-4">
        <Card class="bg-card/50 border-border">
          <CardHeader>
            <Skeleton class="h-6 w-1/3 mb-2" />
            <Skeleton class="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton class="h-16 w-full" />
          </CardContent>
        </Card>
        <Card class="bg-card/50 border-border">
          <CardHeader>
            <Skeleton class="h-6 w-1/3 mb-2" />
            <Skeleton class="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton class="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
