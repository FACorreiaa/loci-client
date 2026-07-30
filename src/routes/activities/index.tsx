import { createSignal, createMemo, Show, onMount, For, lazy } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useChatRPC } from "~/lib/hooks/useChatRPC";
import { POIDetailedInfo } from "~/lib/api/types";
const MapComponent = lazy(() => import("~/components/features/Map/Map"));
import SplitView from "@/components/layout/SplitView";
import { CityInfoHeader } from "@/components/ui/CityInfoHeader";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import FloatingChat from "~/components/features/Chat/FloatingChat";
import { Skeleton } from "~/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { Badge } from "~/ui/badge";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { StreamErrorCard } from "~/components/ui/StreamErrorCard";

export default function ActivitiesPage() {
  const [searchParams] = useSearchParams();
  const [message] = createSignal((searchParams.message as string) || "Show me activities");
  const [cityName] = createSignal((searchParams.cityName as string) || "London");

  const { state, startStream } = useChatRPC();

  const [restoredData, setRestoredData] = createSignal<any>(null);

  // Local favorites state
  const [favorites, setFavorites] = createSignal<string[]>([]);

  const normalizeStoredData = (data: any): any => {
    if (!data) return null;
    const normalized: any = { ...data };

    if (Array.isArray(data.activities)) {
      normalized.activities = data.activities;
    } else if (data.activities_response?.activities) {
      normalized.activities = data.activities_response.activities;
      if (data.activities_response.general_city_data) {
        normalized.general_city_data = data.activities_response.general_city_data;
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

  const activities = createMemo(() => {
    const data = effectiveData();
    if (!data) return [];
    const list = data.activities || data.points_of_interest || [];
    return Array.isArray(list) ? list : [];
  });

  const allPois = createMemo(() => {
    return activities().map((a) => ({
      ...a,
      id: a.name,
      latitude: typeof a.latitude === "string" ? parseFloat(a.latitude) : a.latitude,
      longitude: typeof a.longitude === "string" ? parseFloat(a.longitude) : a.longitude,
    })) as POIDetailedInfo[];
  });

  const handleDownload = () => {
    const data = JSON.stringify(effectiveData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activities-${cityName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Activities in ${cityName()}`,
          text: `Check out these activities in ${cityName()}!`,
          url: window.location.href,
        })
        .catch(console.error);
    }
  };

  const handleBookmark = () => {
    console.log("Bookmark activities list");
  };

  const _handleItemFavorite = (name: string) => {
    setFavorites((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    console.log(`Toggled favorite for: ${name}`);
  };

  const _isFavorite = (name: string) => favorites().includes(name);

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
        <CityInfoHeader cityData={cityData()} isLoading={state.isStreaming && !cityData()} />

        <Show when={state.error}>
          <StreamErrorCard
            error={state.error!}
            title="Unable to load activities"
            onRetry={() => startStream(message(), cityName())}
          />
        </Show>

        <Show when={state.isStreaming && !activities().length}>
          <ActivitiesSkeleton />
        </Show>

        <Show when={activities().length > 0}>
          <div class="mb-8">
            <h3 class="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <span class="text-2xl">🎯</span> Activities ({activities().length})
            </h3>
            <div class="space-y-4">
              <For each={activities()}>
                {(item) => (
                  <Card class="hover:shadow-md transition-all cursor-pointer bg-card/80 backdrop-blur border-border">
                    <CardHeader>
                      <div class="flex justify-between items-start">
                        <CardTitle class="text-lg">{item.name}</CardTitle>
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
                      <div class="text-xs text-muted-foreground">
                        <p>{item.address}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </For>
            </div>
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

function ActivitiesSkeleton() {
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
