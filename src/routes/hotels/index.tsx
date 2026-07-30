import { createSignal, createMemo, Show, onMount, lazy } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useChatRPC } from "~/lib/hooks/useChatRPC";
import { POIDetailedInfo } from "~/lib/api/types";
import HotelResults from "~/components/results/HotelResults";
const MapComponent = lazy(() => import("~/components/features/Map/Map"));
import SplitView from "@/components/layout/SplitView";
import { CityInfoHeader } from "@/components/ui/CityInfoHeader";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import FloatingChat from "~/components/features/Chat/FloatingChat";
import { Skeleton } from "~/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/ui/card";
import { StreamErrorCard } from "~/components/ui/StreamErrorCard";

export default function HotelsPage() {
  const [searchParams] = useSearchParams();
  const [message] = createSignal((searchParams.message as string) || "Show me hotels");
  const [cityName] = createSignal((searchParams.cityName as string) || "London");

  const { state, startStream } = useChatRPC();

  // Local state for restored data from session storage
  const [restoredData, setRestoredData] = createSignal<any>(null);

  // Local favorites state
  const [favorites, setFavorites] = createSignal<string[]>([]);

  // Helper to normalize stored data
  const normalizeStoredData = (data: any): any => {
    if (!data) return null;
    const normalized: any = { ...data };

    if (Array.isArray(data.hotels)) {
      normalized.hotels = data.hotels;
    } else if (data.accommodation_response?.hotels) {
      normalized.hotels = data.accommodation_response.hotels;
      if (data.accommodation_response.general_city_data) {
        normalized.general_city_data = data.accommodation_response.general_city_data;
      }
    }

    return normalized;
  };

  onMount(() => {
    const sessionIdFromUrl = searchParams.sessionId as string;

    if (sessionIdFromUrl) {
      const completedSession = sessionStorage.getItem("completedStreamingSession");
      if (completedSession) {
        try {
          const parsed = JSON.parse(completedSession);
          const parsedData = parsed.data || parsed;

          if (
            parsedData &&
            (parsed.sessionId === sessionIdFromUrl || parsedData.session_id === sessionIdFromUrl)
          ) {
            const normalizedData = normalizeStoredData(parsedData);
            setRestoredData(normalizedData);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse completed streaming session:", e);
        }
      }
      return;
    }

    if (!state.isConnected) {
      startStream(message(), cityName());
    }
  });

  const effectiveData = createMemo(() => restoredData() || state.streamedData);
  const cityData = createMemo(() => effectiveData()?.general_city_data);

  const hotels = createMemo(() => {
    const data = effectiveData();
    if (!data) return [];
    const list =
      data.hotels || data.accommodation_response?.hotels || data.points_of_interest || [];
    return Array.isArray(list) ? list : [];
  });

  const allPois = createMemo(() => {
    return hotels().map((h) => ({
      ...h,
      id: h.name,
      latitude: typeof h.latitude === "string" ? parseFloat(h.latitude) : h.latitude,
      longitude: typeof h.longitude === "string" ? parseFloat(h.longitude) : h.longitude,
    })) as unknown as POIDetailedInfo[];
  });

  const handleDownload = () => {
    const data = JSON.stringify(effectiveData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotels-${cityName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Hotels in ${cityName()}`,
          text: `Check out these hotels in ${cityName()}!`,
          url: window.location.href,
        })
        .catch(console.error);
    }
  };

  const handleBookmark = () => {
    console.log("Bookmark hotels list");
  };

  const handleItemFavorite = (hotel: any) => {
    const name = hotel.name;
    setFavorites((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    console.log(`Toggled favorite for: ${name}`);
  };

  // Map Content
  const MapContent = (
    <div class="h-full w-full bg-muted relative">
      <Show
        when={allPois().length > 0}
        fallback={
          <div class="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {state.isStreaming ? "Loading map data..." : "No items to display on map"}
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
    <div class="h-full overflow-y-auto p-4 md:p-6 bg-background/50 backdrop-blur-sm">
      <div class="max-w-3xl mx-auto pb-20">
        <CityInfoHeader cityData={cityData()} isLoading={state.isStreaming && !cityData()} />

        <Show when={state.error}>
          <StreamErrorCard
            error={state.error!}
            title="Unable to load hotels"
            onRetry={() => startStream(message(), cityName())}
          />
        </Show>

        <Show when={state.isStreaming && !hotels().length}>
          <HotelsSkeleton />
        </Show>

        <Show when={hotels().length > 0}>
          <div class="mb-8">
            <h3 class="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <span class="text-2xl">🏨</span> Hotels ({hotels().length})
            </h3>
            <HotelResults
              hotels={hotels()}
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
      <SplitView listContent={ListContent} mapContent={MapContent} initialMode="map" />
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

function HotelsSkeleton() {
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
