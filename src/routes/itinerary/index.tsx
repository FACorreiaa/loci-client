import { createSignal, createMemo, Show, For, onMount, lazy } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useStreamedRpc } from "@/lib/hooks/useStreamedRpc";
import ItineraryStreamView from "@/components/itinerary/ItineraryStreamView";
import StopCard from "@/components/itinerary/StopCard";
import TripKit from "@/components/itinerary/TripKit";
import EditTripCTA from "@/components/trip/EditTripCTA";
import SectionHeader from "@/components/ui/SectionHeader";
import {
  stopsFromCityResponse,
  type ItineraryStop,
  type StreamPhase,
} from "@/lib/itinerary/createItineraryStream";
const MapComponent = lazy(() => import("@/components/features/Map/Map"));
const DetailedItemModal = lazy(() => import("@/components/DetailedItemModal"));
import type { POI } from "@/components/features/Map/Map";
import { getChatSession } from "@/lib/api/llm";
import { getStoredSession, persistCompletedSession } from "@/lib/utils/chatUtils";

// Stops per itinerary day — the live backend has no day field, so we bucket the
// priority-ordered stops to colour the map by day and group the list.
const STOPS_PER_DAY = 4;
const toNum = (v: unknown): number =>
  typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
import SplitView from "@/components/layout/SplitView";
import { CityInfoHeader } from "@/components/ui/CityInfoHeader";
import LocalWeather from "@/components/LocalWeather";
import TripMoney from "@/components/TripMoney";
import LayerLegend, { type LayerVisibility } from "@/components/features/Map/LayerLegend";
import { isLocatedAlert, useLocalContext } from "@/lib/api/localContext";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import FloatingChat from "@/components/features/Chat/FloatingChat";
import { useSaveItineraryMutation } from "@/lib/api/itineraries";
import { useUserSubscription } from "@/lib/api/billing";
import { isProPlan } from "@/lib/subscription";
import type { TripStop } from "@/lib/trip-kit";
import { useAuth } from "@/contexts/AuthContext";

export default function ItineraryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [layers, setLayers] = createSignal<LayerVisibility>({
    stops: true,
    routes: true,
    alerts: true,
  });
  const [message] = createSignal((searchParams.message as string) || "Show me an itinerary");
  const [cityName] = createSignal((searchParams.cityName as string) || "London");
  const [profileId] = createSignal((searchParams.profileId as string) || "");
  const { isAuthenticated } = useAuth();

  const { store, connect, setStore } = useStreamedRpc(message, cityName, profileId);

  // Mutation hook for bookmarking
  const saveItineraryMutation = useSaveItineraryMutation();
  const subscriptionQuery = useUserSubscription(() => isAuthenticated());
  const isPro = createMemo(() => isProPlan(subscriptionQuery.data?.plan));

  // Helper to normalize stored data - flattens nested itinerary_response structure
  const normalizeStoredData = (data: any): any => {
    if (!data) return null;

    // Check if data is wrapped in itinerary_response that contains the actual payload
    // Server sometimes returns: { itinerary_response: { general_city_data, points_of_interest, itinerary_response, session_id } }
    if (
      data.itinerary_response &&
      (data.itinerary_response.general_city_data || data.itinerary_response.points_of_interest)
    ) {
      const inner = data.itinerary_response;
      return {
        general_city_data: inner.general_city_data,
        points_of_interest: inner.points_of_interest,
        itinerary_response: inner.itinerary_response,
        session_id: inner.session_id || data.session_id,
        // Preserve any other top-level fields
        hotels: data.hotels || inner.hotels,
        restaurants: data.restaurants || inner.restaurants,
        activities: data.activities || inner.activities,
      };
    }

    return data;
  };

  const restoreFromSessionStorage = (sessionIdFromUrl: string): boolean => {
    const completedSession = sessionStorage.getItem("completedStreamingSession");
    if (completedSession) {
      try {
        const parsed = JSON.parse(completedSession);
        const parsedData = parsed.data || parsed;
        if (
          parsedData &&
          (parsed.sessionId === sessionIdFromUrl || parsedData.session_id === sessionIdFromUrl)
        ) {
          setStore("data", normalizeStoredData(parsedData));
          return true;
        }
      } catch (e) {
        console.warn("Failed to parse completed streaming session:", e);
      }
    }

    const activeSession = sessionStorage.getItem("active_streaming_session");
    if (activeSession) {
      try {
        const parsed = JSON.parse(activeSession);
        if (parsed.sessionId === sessionIdFromUrl && parsed.data) {
          setStore("data", normalizeStoredData(parsed.data));
          return true;
        }
      } catch (e) {
        console.warn("Failed to parse active streaming session:", e);
      }
    }

    const storedSession = getStoredSession(sessionIdFromUrl);
    if (storedSession) {
      setStore("data", normalizeStoredData(storedSession));
      return true;
    }

    return false;
  };

  const hydrateFromServer = async (sessionIdFromUrl: string) => {
    setStore("error", null);
    setStore("isLoading", true);

    try {
      const itinerary = await getChatSession(sessionIdFromUrl);
      if (!itinerary || stopsFromCityResponse(itinerary).stops.length === 0) {
        throw new Error("This session has no saved itinerary yet. Try starting a new search.");
      }

      const normalizedData = normalizeStoredData(itinerary);
      setStore("data", normalizedData);
      persistCompletedSession(sessionIdFromUrl, normalizedData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load your itinerary. Please try again.";
      setStore("error", new Error(message));
    } finally {
      setStore("isLoading", false);
    }
  };

  const restoreOrHydrateSession = async (sessionIdFromUrl: string) => {
    if (restoreFromSessionStorage(sessionIdFromUrl)) {
      return;
    }
    await hydrateFromServer(sessionIdFromUrl);
  };

  // Connect on mount - but only if we don't already have data from navigation
  onMount(() => {
    const sessionIdFromUrl = searchParams.sessionId as string;

    if (sessionIdFromUrl) {
      void restoreOrHydrateSession(sessionIdFromUrl);
      return;
    }

    connect();
  });

  const itineraryData = createMemo(() => store.data?.itinerary_response);
  const cityData = createMemo(() => store.data?.general_city_data);
  const pointsOfInterest = createMemo(() => store.data?.points_of_interest || []);

  // --- Editorial streaming model -------------------------------------
  // Derives the skeleton → enrichment shape from whatever the backend
  // has delivered so far. Works today with single-shot AiCityResponse;
  // swap in createItineraryStream().consumeSSE when the Go backend ships
  // true phased events — the view below does not change.
  const itineraryModel = createMemo(() => stopsFromCityResponse(store.data));

  const streamPhase = createMemo<StreamPhase>(() => {
    if (store.error) return "error";
    if (store.isLoading && !store.data) return "skeleton";
    const m = itineraryModel();
    if (!store.data || m.stops.length === 0) return "skeleton";
    if (store.isLoading) return "enriching";
    return m.enrichedCount >= m.stops.length ? "done" : "enriching";
  });

  const handleRetryHydrate = () => {
    const sessionIdFromUrl = searchParams.sessionId as string;
    if (sessionIdFromUrl) {
      void hydrateFromServer(sessionIdFromUrl);
    }
  };

  const handleBackToDiscover = () => {
    navigate("/discover");
  };

  // General POIs that aren't part of the itinerary, as static cards.
  const extraStops = createMemo<ItineraryStop[]>(() => {
    if (!store.data) return [];
    const itinNames = new Set(itineraryModel().stops.map((s) => s.name));
    return stopsFromCityResponse({
      ...(store.data as any),
      itinerary_response: undefined,
    } as any).stops.filter((s) => !itinNames.has(s.name));
  });

  // Aggregate all POIs for the map
  const allPois = createMemo(() => {
    const itineraryPois = itineraryData()?.points_of_interest || [];
    const generalPois = pointsOfInterest();

    const poiMap = new Map<string, any>();

    [...itineraryPois, ...generalPois].forEach((poi) => {
      if (poi && poi.name) {
        // Normalize coordinates and ensure ID exists
        const lat = typeof poi.latitude === "string" ? parseFloat(poi.latitude) : poi.latitude;
        const lng = typeof poi.longitude === "string" ? parseFloat(poi.longitude) : poi.longitude;

        poiMap.set(poi.name, {
          ...poi,
          id: poi.name, // Use name as ID since it's unique enough for display
          latitude: lat || 0,
          longitude: lng || 0,
        });
      }
    });

    return Array.from(poiMap.values());
  });

  // Fast name -> full POI lookup (full POIs carry address/description/etc.).
  const allByName = createMemo(() => {
    const m = new Map<string, any>();
    allPois().forEach((p) => m.set(p.name, p));
    return m;
  });

  // Map POIs in itinerary order, with day bucket + sequence number attached.
  // Itinerary stops first (numbered + day-coloured), then any extra POIs.
  // Live alerts for the destination.
  //
  // The same query LocalWeather runs, and TanStack dedupes on the key, so this
  // shares one fetch rather than making a second. It lives at route level
  // because the map needs the located alerts and the list needs all of them.
  const localContext = useLocalContext(
    () => cityData()?.center_latitude,
    () => cityData()?.center_longitude,
  );
  const alerts = () => localContext.data?.alerts ?? [];
  const locatedAlertCount = () => alerts().filter(isLocatedAlert).length;

  const mapPois = createMemo<POI[]>(() => {
    const byName = allByName();
    const out: POI[] = [];
    const seen = new Set<string>();

    itineraryModel().stops.forEach((s, i) => {
      const geo = byName.get(s.name);
      if (!geo) return;
      seen.add(s.name);
      out.push({
        id: s.name,
        name: s.name,
        category: s.category || geo.category || "",
        latitude: geo.latitude,
        longitude: geo.longitude,
        day: Math.floor(i / STOPS_PER_DAY),
        seq: i + 1,
        rating: s.rating ?? geo.rating,
        timeToSpend: s.timeToSpend,
        budget: s.budget,
        priority: s.priority,
      });
    });

    extraStops().forEach((s) => {
      const geo = byName.get(s.name);
      if (!geo || seen.has(s.name)) return;
      seen.add(s.name);
      out.push({
        id: s.name,
        name: s.name,
        category: s.category || geo.category || "",
        latitude: geo.latitude,
        longitude: geo.longitude,
        seq: out.length + 1,
        rating: s.rating ?? geo.rating,
        timeToSpend: s.timeToSpend,
        budget: s.budget,
      });
    });

    return out;
  });

  // Trip Kit stops: itinerary order + geo/address from full POI map.
  const tripKitStops = createMemo<TripStop[]>(() => {
    const byName = allByName();
    return itineraryModel().stops.map((s, i) => {
      const geo = byName.get(s.name);
      return {
        name: s.name,
        latitude: geo ? toNum(geo.latitude) : undefined,
        longitude: geo ? toNum(geo.longitude) : undefined,
        address: geo?.address,
        category: s.category || geo?.category,
        blurb: s.blurb,
        timeToSpend: s.timeToSpend,
        day: Math.floor(i / STOPS_PER_DAY),
      };
    });
  });

  // Shared selection between list and map (keyed by POI name).
  const [selectedId, setSelectedId] = createSignal<string | undefined>(undefined);

  // Detail modal state.
  const [detailItem, setDetailItem] = createSignal<any | null>(null);
  const [detailOpen, setDetailOpen] = createSignal(false);

  const openDetail = (poi: POI) => {
    const full = allByName().get(poi.name) || poi;
    setDetailItem({
      type: "poi",
      name: full.name,
      latitude: toNum(full.latitude),
      longitude: toNum(full.longitude),
      category: full.category,
      description_poi: full.description_poi || full.description,
      address: full.address,
      website: full.website,
      opening_hours: full.opening_hours,
      rating: full.rating,
      budget: full.budget,
      timeToSpend: full.time_to_spend || full.timeToSpend,
      priority: full.priority,
    });
    setDetailOpen(true);
  };

  const handleDownload = () => {
    const data = JSON.stringify(store.data, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itinerary-${cityName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Itinerary for ${cityName()}`,
          text: `Check out this itinerary for ${cityName()}!`,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      console.log("Share API not supported");
    }
  };

  const handleBookmark = async () => {
    const city = cityData();
    const sessionId = (searchParams.sessionId as string) || store.data?.session_id;
    // const itinerary = itineraryData();

    if (!city?.city) {
      console.warn("Cannot bookmark: No city data available");
      alert("Unable to bookmark: No city data available yet.");
      return;
    }

    const bookmarkData = {
      session_id: sessionId,
      primary_city_name: city.city,
      title: `${city.city} Itinerary`,
      description: city.description || `Itinerary for ${city.city}`,
      tags: [],
      is_public: false,
    };

    try {
      await saveItineraryMutation.mutateAsync(bookmarkData);
      alert(`Itinerary for ${city.city} has been bookmarked!`);
      console.log("✅ Itinerary bookmarked successfully");
    } catch (error) {
      console.error("❌ Failed to bookmark itinerary:", error);
      alert("Failed to bookmark the itinerary. Please try again.");
    }
  };

  // Map Content
  const MapContent = (
    <div class="h-full w-full bg-muted relative">
      <Show
        when={mapPois().length > 0}
        fallback={
          <div class="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {store.isLoading
              ? "Loading map data..."
              : store.error
                ? "Could not load itinerary map"
                : "No items to display on map"}
          </div>
        }
      >
        <MapComponent
          center={[toNum(mapPois()[0]?.longitude), toNum(mapPois()[0]?.latitude)]}
          pointsOfInterest={mapPois()}
          zoom={12}
          selectedId={selectedId()}
          onSelect={(poi) => setSelectedId(poi.name)}
          onActivate={(poi) => openDetail(poi)}
          alerts={alerts()}
          showAlerts={layers().alerts}
          showStops={layers().stops}
          showRoutes={layers().routes}
          cinematic
          fullBleed
        />
      </Show>

      {/* Bottom-left so it clears the ActionToolbar top-left and Mapbox's own
          controls top-right. pointer-events-none on the wrapper keeps the map
          pannable everywhere the panel is not. */}
      <div class="pointer-events-none absolute bottom-4 left-4 z-10">
        <LayerLegend value={layers()} onChange={setLayers} alertCount={locatedAlertCount()} />
      </div>

      {/* Floating Action Toolbar on Map (Desktop only maybe? No, let's put it on top of map) */}
      <div class="absolute top-4 left-4 z-10">
        <ActionToolbar
          onDownload={handleDownload}
          onShare={handleShare}
          onBookmark={handleBookmark}
        />
      </div>
    </div>
  );

  // List Content — editorial streaming itinerary
  const ListContent = (
    <div class="h-full overflow-y-auto px-4 py-6 md:px-8 bg-background">
      <div class="max-w-3xl mx-auto pb-24">
        <Show
          when={!store.error || store.data}
          fallback={
            <div class="loci-card rounded-2xl p-6 text-center space-y-4 mt-8">
              <p class="font-display text-xl text-foreground">Couldn&apos;t build this itinerary</p>
              <p class="text-sm text-muted-foreground">{store.error?.message}</p>
              <button type="button" class="loci-hero__action mx-auto" onClick={() => connect()}>
                Try again
              </button>
              <a href="/chat" class="block text-sm text-primary hover:underline">
                Ask Loci in chat instead
              </a>
            </div>
          }
        >
          <CityInfoHeader cityData={cityData()} isLoading={store.isLoading && !cityData()} />

          <Show when={cityData()?.center_latitude}>
            <div class="mt-3 space-y-3">
              <LocalWeather
                latitude={cityData()?.center_latitude}
                longitude={cityData()?.center_longitude}
              />
              {/* Coordinates, not cityData().country — that field is
                  LLM-generated prose, and the server resolves a currency from
                  a position far more reliably than from a name. */}
              <TripMoney
                latitude={cityData()?.center_latitude}
                longitude={cityData()?.center_longitude}
              />
            </div>
          </Show>

          <ItineraryStreamView
            phase={streamPhase()}
            title={itineraryModel().title}
            summary={itineraryModel().summary}
            stops={itineraryModel().stops}
            enrichedCount={itineraryModel().enrichedCount}
            error={store.error?.message}
            onRetry={searchParams.sessionId ? handleRetryHydrate : undefined}
            onBack={searchParams.sessionId ? handleBackToDiscover : undefined}
            stopsPerDay={STOPS_PER_DAY}
            selectedKey={selectedId()}
            onStopClick={(stop) => setSelectedId(stop.name)}
          />

          <TripKit
            title={itineraryModel().title}
            cityName={cityName()}
            summary={itineraryModel().summary}
            stops={tripKitStops()}
            isPro={isPro()}
            visible={
              streamPhase() === "done" || (itineraryModel().stops.length > 0 && !store.isLoading)
            }
            stopsPerDay={STOPS_PER_DAY}
          />

          <Show when={store.tripId || (searchParams.tripId as string | undefined)}>
            <div class="mt-4">
              <EditTripCTA
                tripId={(store.tripId || (searchParams.tripId as string)) ?? null}
                cityName={cityName()}
              />
            </div>
          </Show>

          <Show when={extraStops().length > 0}>
            <div class="mt-10">
              <SectionHeader
                kicker="Also nearby"
                title="More to explore"
                subtitle="Optional stops around your route"
              />
              <div class="space-y-3">
                <For each={extraStops()}>
                  {(stop, i) => (
                    <StopCard
                      stop={stop}
                      index={i()}
                      selected={selectedId() === stop.name}
                      onClick={(s) => setSelectedId(s.name)}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );

  return (
    <>
      <SplitView listContent={ListContent} mapContent={MapContent} initialMode="map" />
      <Show when={detailOpen()}>
        <DetailedItemModal
          item={detailItem()}
          isOpen={detailOpen()}
          onClose={() => setDetailOpen(false)}
        />
      </Show>
      <FloatingChat
        getStreamingData={() => store.data}
        setStreamingData={(fn) => setStore("data", fn)}
        initialSessionId={searchParams.sessionId as string}
      />
    </>
  );
}
