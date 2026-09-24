import { createSignal, createMemo, createEffect, Show, For, onCleanup, onMount } from "solid-js";
import { lazyChunk } from "@/lib/lazyChunk";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { createSessionKey } from "~/lib/runs/session-key";
import { useStreamedRpc } from "@/lib/hooks/useStreamedRpc";
import { useTypedText } from "@/lib/hooks/useTypedText";
import { readActiveSession, useLiveSession } from "@/lib/streaming/live-stream-store";
import { resumeLiveSession } from "@/lib/streaming/resume-live";
import ItineraryStreamView from "@/components/itinerary/ItineraryStreamView";
import StopCard from "@/components/itinerary/StopCard";
import TripKit from "@/components/itinerary/TripKit";
import EditTripCTA from "@/components/trip/EditTripCTA";
import SectionHeader from "@/components/ui/SectionHeader";
import { hasItineraryContent, normalizeItineraryPayload } from "@/lib/itinerary/normalize-payload";
import {
  stopsFromCityResponse,
  type ItineraryStop,
  type StreamPhase,
} from "@/lib/itinerary/createItineraryStream";
const MapComponent = lazyChunk(() => import("@/components/features/Map/Map"));
const DetailedItemModal = lazyChunk(() => import("@/components/DetailedItemModal"));
import type { POI } from "@/components/features/Map/Map";
import { getChatSession } from "@/lib/api/llm";
import { getStoredSession, persistCompletedSession } from "@/lib/utils/chatUtils";

// Stops per itinerary day, used only when the server did not say.
//
// It used to be the rule rather than the fallback, which had the dependency
// backwards: days were derived from how many places came back, so a four-day
// trip with twenty-four places rendered as six. The server now assigns a day
// per stop; this only covers answers produced before it did.
const STOPS_PER_DAY = 4;

// dayOf is which day a stop belongs to: the server's answer when there is one,
// otherwise the old bucketing.
const dayOf = (stop: { day?: number }, index: number): number =>
  typeof stop.day === "number" ? stop.day : Math.floor(index / STOPS_PER_DAY);
const toNum = (v: unknown): number =>
  typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
import SplitView from "@/components/layout/SplitView";
import { StopSwitcher } from "@/components/features/MultiCity/StopSwitcher";
import { LegRow } from "@/components/features/MultiCity/LegRow";
import {
  mapView,
  mergedResponse,
  parseStopsParam,
  tripWideResponse,
} from "@/components/features/MultiCity/multi-city-view";
import { CityInfoHeader } from "@/components/ui/CityInfoHeader";
import LocalWeather from "@/components/LocalWeather";
import TripMoney from "@/components/TripMoney";
import LayerLegend, { type LayerVisibility } from "@/components/features/Map/LayerLegend";
import { isLocatedAlert, useLocalContext } from "@/lib/api/localContext";
import { ActionToolbar } from "@/components/ui/ActionToolbar";
import { StreamErrorCard } from "@/components/ui/StreamErrorCard";
import FloatingChat from "@/components/features/Chat/FloatingChat";
import { useSaveItineraryMutation } from "@/lib/api/itineraries";
import { useUserSubscription } from "@/lib/api/billing";
import { isProPlan } from "@/lib/subscription";
import type { TripStop } from "@/lib/trip-kit";
import { useAuth } from "@/contexts/AuthContext";
import { saveItineraryOffline, getOfflineItinerary } from "@/lib/itinerary-offline-store";
import { SHARE_HOME_URL, type SharePayload } from "@/lib/share";

/**
 * Keyed on the search it shows, so Open from a toast to this same route with
 * another sessionId remounts the body and its restore logic runs for that
 * session (Solid Router keeps a route mounted across query changes). A search
 * this page starts itself writes its id into the URL once the server names
 * it; the page adopts that id first so the step does not remount it.
 */
export default function ItineraryPage() {
  const [searchParams] = useSearchParams();
  const session = createSessionKey(() => searchParams);
  return (
    <Show when={session.key()} keyed>
      {(_key) => <ItineraryView adopt={session.adopt} />}
    </Show>
  );
}

function ItineraryView(props: { adopt: (sessionId: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  let mounted = true;
  onCleanup(() => (mounted = false));
  const navigate = useNavigate();
  const [layers, setLayers] = createSignal<LayerVisibility>({
    stops: true,
    routes: true,
    alerts: true,
  });
  // No defaults. These used to fall back to "Show me an itinerary" and
  // "London", so a lost session id — which happens whenever a payload-less
  // COMPLETE frame maps sessionId to "" — silently streamed a generic London
  // itinerary to somebody who had asked about Funchal. Streaming the wrong city
  // is worse than showing nothing, so an absent query renders the empty state
  // instead.
  const [message] = createSignal((searchParams.message as string) || "");
  const [cityName] = createSignal((searchParams.cityName as string) || "");
  const [profileId] = createSignal((searchParams.profileId as string) || "");
  const { isAuthenticated } = useAuth();

  // The stream that a search on `/` started is still running on the service
  // singleton; if its session id is the one in the URL, render it as it
  // arrives instead of waiting for sessionStorage or the server.
  const live = useLiveSession(() => searchParams.sessionId as string | undefined);
  const [boundLive, setBoundLive] = createSignal(false);
  // Set once a finished live run has been handed to the server fetch below.
  let hydratedAfterLive = false;

  // This page's own search runs on that same service (useStreamedRpc), so it
  // keeps going when you leave and RunWatcher tells you how it ended. The
  // moment the server names it, put it in the URL — RunWatcher then knows you
  // are on its page, and a reload or Open from a toast restores it — and
  // render it from the live store like any other run. A `start` that lands
  // after you left must not touch the URL of wherever you are now.
  // A multi-city search from the stop builder: ?stops=Lisbon:3,Porto:2&suggest=1
  const [stopsParam] = createSignal(parseStopsParam(searchParams.stops as string | undefined));
  const [suggestOrder] = createSignal(searchParams.suggest === "1");
  const { store, connect, setStore } = useStreamedRpc(
    message,
    cityName,
    profileId,
    {
      onStart: (sessionId) => {
        if (!mounted) return;
        props.adopt(sessionId);
        setSearchParams({ sessionId }, { replace: true });
        hydratedAfterLive = false;
        setBoundLive(true);
      },
    },
    stopsParam,
    suggestOrder,
  );

  // Mutation hook for bookmarking
  const saveItineraryMutation = useSaveItineraryMutation();
  const subscriptionQuery = useUserSubscription(() => isAuthenticated());
  const isPro = createMemo(() => isProPlan(subscriptionQuery.data?.plan));
  const [savedOffline, setSavedOffline] = createSignal(false);
  // isPro is derived from a query, so "not loaded yet" and "genuinely free"
  // both read as false. The trip kit needs to tell them apart: exporting on the
  // first reading silently handed a Pro account a Day-1 file.
  const planState = createMemo<"loading" | "known" | "unknown">(() => {
    if (!isAuthenticated()) return "known";
    if (subscriptionQuery.isPending || subscriptionQuery.isLoading) return "loading";
    if (subscriptionQuery.isError || subscriptionQuery.data === undefined) return "unknown";
    return "known";
  });

  const restoreFromSessionStorage = (sessionIdFromUrl: string): boolean => {
    const completedSession = sessionStorage.getItem("completedStreamingSession");
    if (completedSession) {
      try {
        const parsed = JSON.parse(completedSession);
        const parsedData = parsed.data || parsed;
        const normalized = normalizeItineraryPayload(parsedData);
        // Both conditions, and content is one of them: a session id that
        // matches but carries nothing must fall through to hydration rather
        // than being treated as restored.
        if (
          normalized &&
          (parsed.sessionId === sessionIdFromUrl || parsedData?.session_id === sessionIdFromUrl)
        ) {
          setStore("data", normalized);
          return true;
        }
      } catch (e) {
        console.warn("Failed to parse completed streaming session:", e);
      }
    }

    // One envelope per run in flight; readActiveSession picks this page's.
    const activeSession = readActiveSession(sessionIdFromUrl);
    if (activeSession?.data) {
      const normalizedActive = normalizeItineraryPayload(activeSession.data);
      if (normalizedActive) {
        setStore("data", normalizedActive);
        return true;
      }
    }

    const storedSession = normalizeItineraryPayload(getStoredSession(sessionIdFromUrl));
    if (storedSession) {
      setStore("data", storedSession);
      return true;
    }

    return false;
  };

  /**
   * Ask the server for the itinerary this session saved.
   *
   * Returns whether it found one, and no longer decides what an empty result
   * means. A session with nothing saved is not necessarily an error — when the
   * original query is still in the URL it is a reason to re-run the search —
   * so the caller owns that choice. See restoreOrHydrateSession.
   */
  const hydrateFromServer = async (sessionIdFromUrl: string): Promise<boolean> => {
    setStore("error", null);
    setStore("isLoading", true);

    try {
      const itinerary = await getChatSession(sessionIdFromUrl);
      if (!itinerary || stopsFromCityResponse(itinerary).stops.length === 0) {
        return false;
      }

      const normalizedData = normalizeItineraryPayload(itinerary);
      setStore("data", normalizedData);
      persistCompletedSession(sessionIdFromUrl, normalizedData);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load your itinerary. Please try again.";
      setStore("error", new Error(message));
      return true;
    } finally {
      setStore("isLoading", false);
    }
  };

  // The copy saved on this device. Before the server: it is what the person
  // chose to keep, it answers instantly, and it is the only source with no
  // network. Until this existed the copy was written and never read back, so
  // a saved itinerary opened offline showed "could not load".
  const restoreFromDevice = async (sessionIdFromUrl: string): Promise<boolean> => {
    try {
      const saved = await getOfflineItinerary(sessionIdFromUrl);
      const normalized = saved ? normalizeItineraryPayload(saved.payload) : null;
      if (!normalized || !hasItineraryContent(normalized)) return false;
      setStore("data", normalized);
      setSavedOffline(true);
      return true;
    } catch (e) {
      console.warn("Could not read the offline copy:", e);
      return false;
    }
  };

  const restoreOrHydrateSession = async (sessionIdFromUrl: string) => {
    if (restoreFromSessionStorage(sessionIdFromUrl)) {
      return;
    }
    if (await restoreFromDevice(sessionIdFromUrl)) {
      return;
    }
    if (await hydrateFromServer(sessionIdFromUrl)) {
      return;
    }

    // The session saved nothing. Re-run the search when the URL still says what
    // was asked.
    //
    // /hotels, /restaurants and /activities have always fallen through to the
    // query here; this route stopped at "this session has no saved itinerary
    // yet" instead. That gap became visible when /recents started linking here:
    // the completed-session store holds exactly one session, so every row but
    // the most recent one in this tab restored nothing and dead-ended — a
    // history page where almost none of the history opened.
    //
    // Repeating an identical prompt is close to free: the generation cache
    // serves it from Postgres without a provider call.
    if (message().trim() && cityName().trim()) {
      connect();
      return;
    }

    setStore(
      "error",
      new Error("This session has no saved itinerary yet. Try starting a new search."),
    );
  };

  // Connect on mount - but only if we don't already have data from navigation
  // Mirror the live stream into the page store. Partial payloads are the
  // point here — city data before stops, stops before photos — so the content
  // guard only applies once the stream has finished.
  //
  // A run that finished with no data listed was resumed after the server's
  // buffer was gone (load_from_session): the result is not in the store, so
  // load it from the server, once. Only if that finds nothing is it an error.
  createEffect(() => {
    if (!boundLive()) return;
    const data = live.data();
    const phase = live.phase();
    if (data) setStore("data", normalizeItineraryPayload(data) ?? (data as any));
    setStore("isLoading", phase === "connecting" || phase === "streaming");
    const err = live.error();
    if (err) setStore("error", new Error(err));
    if (phase === "complete" && (!data || !hasItineraryContent(store.data))) {
      const sessionId = searchParams.sessionId as string | undefined;
      if (hydratedAfterLive || !sessionId) return;
      hydratedAfterLive = true;
      void hydrateFromServer(sessionId).then((found) => {
        if (!found && !hasItineraryContent(store.data)) {
          setStore(
            "error",
            new Error("This search finished without an itinerary. Try a new search."),
          );
        }
      });
    }
  });

  onMount(() => {
    const sessionIdFromUrl = searchParams.sessionId as string;

    // Check if this itinerary is already saved offline
    if (sessionIdFromUrl) {
      void getOfflineItinerary(sessionIdFromUrl).then((existing) => {
        if (existing) setSavedOffline(true);
      });
    }

    if (sessionIdFromUrl) {
      // Live (or resumable after a reload) → bind; otherwise the stored /
      // server copies as before. A listed run that failed is not something
      // to bind to either, the same guard the list routes carry.
      if (resumeLiveSession(sessionIdFromUrl) && live.phase() !== "error") {
        setBoundLive(true);
        setStore("isLoading", true);
        return;
      }
      void restoreOrHydrateSession(sessionIdFromUrl);
      return;
    }

    // No session and no query. Previously message/cityName defaulted to
    // "Show me an itinerary"/"London" and this streamed a generic London
    // itinerary — spending a request and showing the wrong city to somebody
    // who asked about somewhere else. Say what is missing instead.
    if (!message().trim() || !cityName().trim()) {
      setStore(
        "error",
        new Error("Tell Loci where you're going and we'll plot it. Try a search to start."),
      );
      return;
    }

    connect();
  });

  // --- Multi-city ------------------------------------------------------
  // A multi-city run is one result per city. The page's views all read
  // viewData(): the chosen city's result, or — on "All days" — every city in
  // one response with its days numbered across the trip.
  const route = createMemo(() => (boundLive() ? live.route() : null) ?? store.route);
  const cityStops = createMemo(() => {
    const fromLive = boundLive() ? live.stops() : [];
    return fromLive.length > 0 ? fromLive : store.stops;
  });
  const isMulti = createMemo(() => cityStops().length >= 2);
  const [activeStop, setActiveStop] = createSignal<number | "all">("all");
  const activeCity = createMemo(() => {
    const a = activeStop();
    return a === "all" ? undefined : cityStops().find((s) => s.index === a);
  });
  const viewData = createMemo<any>(() => {
    if (!isMulti()) return store.data;
    const city = activeCity();
    if (city) return tripWideResponse(city);
    return mergedResponse(cityStops()) ?? store.data;
  });

  const itineraryData = createMemo(() => viewData()?.itinerary_response);
  const cityData = createMemo(() => viewData()?.general_city_data);

  // Structured text types out while the stream is live; restored sessions
  // show it whole. Nothing token-level is ever rendered.
  const typedDescription = useTypedText(
    () => cityData()?.description,
    () => boundLive() && live.isStreaming(),
  );
  const typedSummary = useTypedText(
    () => viewData()?.itinerary_response?.overall_description,
    () => boundLive() && live.isStreaming(),
  );
  const pointsOfInterest = createMemo(() => viewData()?.points_of_interest || []);

  // --- Editorial streaming model -------------------------------------
  // Derives the skeleton → enrichment shape from whatever the backend
  // has delivered so far. Works today with single-shot AiCityResponse;
  // swap in createItineraryStream().consumeSSE when the Go backend ships
  // true phased events — the view below does not change.
  const itineraryModel = createMemo(() => stopsFromCityResponse(viewData()));

  const streamPhase = createMemo<StreamPhase>(() => {
    if (store.error) return "error";
    if (store.isLoading && !viewData()) return "skeleton";
    const m = itineraryModel();
    if (!viewData() || m.stops.length === 0) return "skeleton";
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
    if (!viewData()) return [];
    const itinNames = new Set(itineraryModel().stops.map((s) => s.name));
    return stopsFromCityResponse({
      ...(viewData() as any),
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
        // Normalize coordinates. The id is kept as the server sent it: the
        // detail modal loads PlaceFacts by it, and this used to overwrite it
        // with the name, so the facts request was made for "Tower Bridge"
        // and never found anything. The map keys selection by name on its
        // own (see mapPois), so nothing here needs the id to be the name.
        const lat = typeof poi.latitude === "string" ? parseFloat(poi.latitude) : poi.latitude;
        const lng = typeof poi.longitude === "string" ? parseFloat(poi.longitude) : poi.longitude;

        poiMap.set(poi.name, {
          ...poi,
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
        day: dayOf(s, i),
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
        day: dayOf(s, i),
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
      id: full.id || full.placeId || full.place_id,
      name: full.name,
      latitude: toNum(full.latitude),
      longitude: toNum(full.longitude),
      category: full.category,
      description_poi: full.description_poi || full.description,
      grounded: full.grounded,
      address: full.address,
      website: full.website,
      phone_number: full.phone_number,
      opening_hours: full.opening_hours,
      rating: full.rating,
      price_range: full.price_range || full.price_level,
      budget: full.budget,
      timeToSpend: full.time_to_spend || full.timeToSpend,
      priority: full.priority,
      distance: typeof full.distance === "number" && full.distance > 0 ? full.distance : undefined,
      tags: full.tags,
      image_credits: full.image_credits,
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

  const sharePayload = createMemo<SharePayload>(() => ({
    cityName: cityData()?.city || cityName() || "",
    title: itineraryModel().title || `${cityData()?.city || cityName()} Itinerary`,
    description: cityData()?.description,
    // The Loci home, not this page: this URL names a private session nobody
    // else can open. See src/lib/share.ts.
    url: SHARE_HOME_URL,
    stopCount: itineraryModel().stops.length,
    stops: itineraryModel().stops.map((s, i) => ({ name: s.name, day: dayOf(s, i) })),
  }));

  const [saving, setSaving] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal("");
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const showStatus = (text: string) => {
    setSaveStatus(text);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => setSaveStatus(""), 4000);
  };

  // One Save. The device copy is the point — it is what makes the itinerary
  // open with no network — so it is written first and counts as success on
  // its own. The account bookmark follows when signed in; the server keeps
  // only title and city (its session id is not accepted), so a failure there
  // is reported, not treated as losing the save.
  const handleSave = async () => {
    const sessionId = (searchParams.sessionId as string) || store.data?.session_id;
    const city = cityData();
    if (!sessionId || !store.data || !hasItineraryContent(store.data)) {
      showStatus("Nothing to save yet");
      return;
    }
    const title = itineraryModel().title || `${city?.city || cityName()} Itinerary`;
    setSaving(true);
    try {
      await saveItineraryOffline({
        id: sessionId,
        cityName: city?.city || cityName() || "Unknown",
        title,
        description: city?.description,
        payload: store.data,
        stopCount: itineraryModel().stops.length,
        savedAt: new Date().toISOString(),
        sourceUrl: typeof window !== "undefined" ? window.location.href : "",
      });
      setSavedOffline(true);
    } catch (error) {
      console.error("Failed to save on this device:", error);
      showStatus("Could not save on this device");
      setSaving(false);
      return;
    }

    if (!isAuthenticated() || !city?.city) {
      showStatus("Saved on this device");
      setSaving(false);
      return;
    }
    try {
      await saveItineraryMutation.mutateAsync({
        primary_city_name: city.city,
        title,
        description: city.description || `Itinerary for ${city.city}`,
        tags: [],
        is_public: false,
      });
      showStatus("Saved on this device and to your account");
    } catch (error) {
      console.error("Failed to bookmark itinerary:", error);
      showStatus("Saved on this device · account sync failed");
    } finally {
      setSaving(false);
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
          center={
            isMulti()
              ? mapView(
                  mapPois().map((p) => ({
                    latitude: toNum(p.latitude),
                    longitude: toNum(p.longitude),
                  })),
                ).center
              : [toNum(mapPois()[0]?.longitude), toNum(mapPois()[0]?.latitude)]
          }
          pointsOfInterest={mapPois()}
          zoom={
            isMulti()
              ? mapView(
                  mapPois().map((p) => ({
                    latitude: toNum(p.latitude),
                    longitude: toNum(p.longitude),
                  })),
                ).zoom
              : 12
          }
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
          onSave={() => void handleSave()}
          isSaved={savedOffline()}
          saving={saving()}
          status={saveStatus()}
          sharePayload={sharePayload()}
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
            <div class="mt-8 space-y-4">
              {/* The shared failure card: it knows a quota error from a
                  transient one and routes the first to /pricing, where a
                  plain "Try again" would only spend another request. */}
              <StreamErrorCard
                error={store.error?.message ?? ""}
                title="Couldn't build this itinerary"
                onRetry={() => connect()}
              />
              <a href="/chat" class="block text-center text-sm text-primary hover:underline">
                Ask Loci in chat instead
              </a>
            </div>
          }
        >
          <Show when={isMulti()}>
            <div class="mb-5 space-y-2">
              <StopSwitcher
                stops={cityStops()}
                active={activeStop()}
                onSelect={setActiveStop}
                showAll
              />
              <Show when={route()?.outline}>
                <p class="text-sm text-muted-foreground">{route()!.outline}</p>
              </Show>
              <Show when={(route()?.dropped.length ?? 0) > 0}>
                <p class="text-xs text-muted-foreground">
                  Left out:{" "}
                  {route()!
                    .dropped.map((d) => `${d.cityName} (${d.reason})`)
                    .join("; ")}
                </p>
              </Show>
            </div>
          </Show>

          <CityInfoHeader
            cityData={cityData()}
            isLoading={store.isLoading && !cityData()}
            description={typedDescription()}
          />

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

          <Show
            when={isMulti() && activeStop() === "all"}
            fallback={
              <Show
                when={activeCity()?.error}
                fallback={
                  <ItineraryStreamView
                    phase={streamPhase()}
                    title={itineraryModel().title}
                    summary={typedSummary() || itineraryModel().summary}
                    stops={itineraryModel().stops}
                    enrichedCount={itineraryModel().enrichedCount}
                    error={store.error?.message}
                    onRetry={searchParams.sessionId ? handleRetryHydrate : undefined}
                    onBack={searchParams.sessionId ? handleBackToDiscover : undefined}
                    stopsPerDay={STOPS_PER_DAY}
                    selectedKey={selectedId()}
                    onStopClick={(stop) => setSelectedId(stop.name)}
                  />
                }
              >
                <StreamErrorCard
                  error={activeCity()!.error!}
                  title={`Couldn't plan ${activeCity()!.cityName}`}
                  onRetry={() =>
                    navigate(
                      `/itinerary?message=${encodeURIComponent(message() || "trip")}&cityName=${encodeURIComponent(activeCity()!.cityName)}`,
                    )
                  }
                />
              </Show>
            }
          >
            {/* Every day of the trip, city by city, with the move between them. */}
            <For each={cityStops()}>
              {(stop) => {
                const model = createMemo(() =>
                  stopsFromCityResponse(tripWideResponse(stop) as any),
                );
                const leg = () =>
                  route()?.legs.find(
                    (l) =>
                      l.fromName === stop.cityName &&
                      l.afterDay === stop.dayNumbers[stop.dayNumbers.length - 1],
                  );
                return (
                  <section class="mb-6">
                    <SectionHeader
                      title={stop.cityName}
                      subtitle={`Day ${stop.dayNumbers[0]}${stop.dayNumbers.length > 1 ? `–${stop.dayNumbers[stop.dayNumbers.length - 1]}` : ""}`}
                    />
                    <Show
                      when={!stop.error}
                      fallback={<p class="text-sm text-muted-foreground">{stop.error}</p>}
                    >
                      <ItineraryStreamView
                        phase={
                          model().stops.length === 0 ? "skeleton" : stop.done ? "done" : "enriching"
                        }
                        title={model().title}
                        summary={model().summary}
                        stops={model().stops}
                        enrichedCount={model().enrichedCount}
                        stopsPerDay={STOPS_PER_DAY}
                        selectedKey={selectedId()}
                        onStopClick={(s) => setSelectedId(s.name)}
                      />
                    </Show>
                    <Show when={leg()}>
                      <LegRow leg={leg()!} />
                    </Show>
                  </section>
                );
              }}
            </For>
          </Show>

          <TripKit
            title={itineraryModel().title}
            cityName={cityName()}
            summary={itineraryModel().summary}
            stops={tripKitStops()}
            isPro={isPro()}
            planState={planState()}
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
      <SplitView listContent={ListContent} mapContent={MapContent} initialMode="split" />
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
