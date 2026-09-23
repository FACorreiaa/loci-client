import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  For,
  Show,
} from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Check, Sparkles } from "lucide-solid";
import { lazyChunk } from "~/lib/lazyChunk";
import { useChatRPC } from "~/lib/hooks/useChatRPC";
import { readCompletedSession } from "~/lib/streaming/restore-session";
import { useLiveSession } from "~/lib/streaming/live-stream-store";
import { resumeLiveSession } from "~/lib/streaming/resume-live";
import { hydrateSession } from "~/lib/streaming/hydrate-session";
import { getChatSession } from "~/lib/api/llm";
import { persistCompletedSession } from "~/lib/utils/chatUtils";
import { getOfflineItinerary, saveItineraryOffline } from "~/lib/itinerary-offline-store";
import { useSaveItineraryMutation } from "~/lib/api/itineraries";
import { useUserSubscription } from "~/lib/api/billing";
import { isProPlan } from "~/lib/subscription";
import { useAuth } from "~/contexts/AuthContext";
import { isLocatedAlert, useLocalContext } from "~/lib/api/localContext";
import { SHARE_HOME_URL, type SharePayload } from "~/lib/share";
import type { TripStop } from "~/lib/trip-kit";
import type { ItineraryStop } from "~/lib/itinerary/createItineraryStream";
import type { POIDetailedInfo } from "~/lib/api/types";
import type { POI } from "~/components/features/Map/types";
import { DOMAINS, listTitle, unwrapDomainResults, type ResultsDomain } from "~/lib/results/domain";
import { rememberResultsSession } from "~/lib/results/last-session";
import SplitView from "~/components/layout/SplitView";
import { CityInfoHeader } from "~/components/ui/CityInfoHeader";
import { ActionToolbar } from "~/components/ui/ActionToolbar";
import { StreamErrorCard } from "~/components/ui/StreamErrorCard";
import SectionHeader from "~/components/ui/SectionHeader";
import LocalWeather from "~/components/LocalWeather";
import TripMoney from "~/components/TripMoney";
import LayerLegend, { type LayerVisibility } from "~/components/features/Map/LayerLegend";
import FloatingChat from "~/components/features/Chat/FloatingChat";
import StopCardSkeleton from "~/components/itinerary/StopCardSkeleton";
import TripKit from "~/components/itinerary/TripKit";
import ResultsList from "./ResultsList";
import "~/styles/editorial.css";

const MapComponent = lazyChunk(() => import("~/components/features/Map/Map"));
const DetailedItemModal = lazyChunk(() => import("~/components/DetailedItemModal"));

const toNum = (v: unknown): number =>
  typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;

/** Every place in a list is "today": one day, exported whole. */
const LIST_DAY = 0;
/** What a stop on a list is worth in the calendar export. */
const LIST_STOP_MINUTES = 90;

export interface ResultsPageProps {
  domain: ResultsDomain;
  /** From createSessionKey: the page's own run must not remount it. */
  adopt: (sessionId: string) => void;
}

/**
 * The body of /hotels, /restaurants and /activities.
 *
 * The same page /itinerary is, for a flat list: split view with the city
 * header, weather and money, a status rail while the stream runs, stop cards
 * synced with the map, the detail modal, one Save, the share menu and the
 * trip kit. Each route wraps this in the keyed <Show> that remounts it when
 * the session in the URL changes, and passes the domain.
 *
 * A phone gets the map as a card above the list (SplitView's hero mode), not
 * the List/Map switch.
 */
export default function ResultsPage(props: ResultsPageProps) {
  const meta = () => DOMAINS[props.domain];
  const [searchParams, setSearchParams] = useSearchParams();
  let mounted = true;
  onCleanup(() => (mounted = false));

  // No defaults. These used to fall back to a generic query and "London", so
  // a lost session id silently streamed London to somebody who had asked
  // about somewhere else. An absent query is an error, not a different city.
  const [message] = createSignal((searchParams.message as string) || "");
  const [cityName, setCityName] = createSignal((searchParams.cityName as string) || "");
  const [profileId] = createSignal((searchParams.profileId as string) || "");
  const { isAuthenticated } = useAuth();

  const { state, startStream, setError } = useChatRPC({
    // Put the run in the URL the moment the server names it: RunWatcher then
    // knows you are on its page, leaving it offers the push prompt, and a
    // reload restores it. The city goes in with it so a page opened with a
    // bare message still says where it is. Adopted first, so the keyed
    // wrapper does not remount this component mid-stream. The stream
    // outlives this page, so a `start` that lands after you left must not
    // touch the URL of wherever you are now.
    onStart: (sessionId, city) => {
      if (!mounted) return;
      const resolvedCity = cityName() || city || "";
      if (resolvedCity && !cityName()) setCityName(resolvedCity);
      props.adopt(sessionId);
      setSearchParams({ sessionId, cityName: resolvedCity || undefined }, { replace: true });
      rememberResultsSession(props.domain, { sessionId, cityName: resolvedCity });
    },
  });

  const [restoredData, setRestoredData] = createSignal<any>(null);
  // A search started on `/` streams on the service singleton; when its
  // session is the one in the URL, read it live (see live-stream-store.ts).
  const live = useLiveSession(() => searchParams.sessionId as string | undefined);
  const [boundLive, setBoundLive] = createSignal(false);
  // True while a restore is in flight, so the skeleton shows instead of a
  // blank panel during the fetch.
  const [hydrating, setHydrating] = createSignal(false);
  const [savedOffline, setSavedOffline] = createSignal(false);

  const saveItineraryMutation = useSaveItineraryMutation();
  const subscriptionQuery = useUserSubscription(() => isAuthenticated());
  const isPro = createMemo(() => isProPlan(subscriptionQuery.data?.plan));
  const planState = createMemo<"loading" | "known" | "unknown">(() => {
    if (!isAuthenticated()) return "known";
    if (subscriptionQuery.isPending || subscriptionQuery.isLoading) return "loading";
    if (subscriptionQuery.isError || subscriptionQuery.data === undefined) return "unknown";
    return "known";
  });

  const [layers, setLayers] = createSignal<LayerVisibility>({
    stops: true,
    routes: false,
    alerts: true,
  });

  // A payload counts as a restore only when it has something to show.
  const accept = (data: unknown): boolean => {
    if (!unwrapDomainResults(data, props.domain)) return false;
    setRestoredData(data);
    return true;
  };

  // startOrExplain is both the mount path and the retry path, so Retry does
  // the same thing arriving on the page does.
  const startOrExplain = () => {
    if (!message().trim() || !cityName().trim()) {
      setError("Tell Loci what you're looking for and where. Try a search to start.");
      return;
    }
    void startStream(message(), cityName(), undefined, profileId() || undefined);
  };

  // The copy saved on this device: the person chose to keep it, it answers
  // instantly, and it is the only source with no network.
  const restoreFromDevice = async (sessionId: string): Promise<boolean> => {
    try {
      const saved = await getOfflineItinerary(sessionId);
      if (!saved || !accept(saved.payload)) return false;
      setSavedOffline(true);
      return true;
    } catch (e) {
      console.warn("Could not read the offline copy:", e);
      return false;
    }
  };

  // The session as the server stored it. Since proto v5.22.0 that carries
  // the domain lists themselves, so a list restores as the list it was,
  // not as a re-run. Cached locally so the next open needs no fetch.
  const restoreFromServer = async (sessionId: string): Promise<boolean> => {
    try {
      const session = await getChatSession(sessionId);
      if (!session || !accept(session)) return false;
      persistCompletedSession(sessionId, session);
      return true;
    } catch (e) {
      console.warn("Could not load the session from the server:", e);
      return false;
    }
  };

  // The per-section list, for sessions saved before the lists were stored
  // on the session.
  const restoreFromSectionList = async (sessionId: string): Promise<boolean> => {
    const fromServer = await hydrateSession(sessionId, meta().section, props.domain);
    return Boolean(fromServer && accept(fromServer));
  };

  // Live → this tab's completed session → the device copy → the server's
  // session → the server's section list → re-run the query. Each step is
  // cheaper or more certain than the next; a re-run is the last resort
  // because it spends a request.
  const restoreOrHydrate = async (sessionId: string) => {
    if (accept(readCompletedSession(sessionId))) return;
    setHydrating(true);
    try {
      if (await restoreFromDevice(sessionId)) return;
      if (await restoreFromServer(sessionId)) return;
      if (await restoreFromSectionList(sessionId)) return;
    } finally {
      setHydrating(false);
    }
    if (!state.isConnected) startOrExplain();
  };

  onMount(() => {
    const sessionIdFromUrl = searchParams.sessionId as string;

    if (sessionIdFromUrl) {
      rememberResultsSession(props.domain, { sessionId: sessionIdFromUrl, cityName: cityName() });
      void getOfflineItinerary(sessionIdFromUrl).then((existing) => {
        if (existing) setSavedOffline(true);
      });
      // A live run in phase "error" is still listed (finished runs stay for
      // the tab's life), but this page must not bind to somebody else's
      // failure — fall through to the restore path instead.
      if (resumeLiveSession(sessionIdFromUrl) && live.phase() !== "error") {
        setBoundLive(true);
        return;
      }
      void restoreOrHydrate(sessionIdFromUrl);
      return;
    }

    if (!state.isConnected) startOrExplain();
  });

  const liveData = createMemo(() => (boundLive() ? live.data() : null));
  const effectiveData = createMemo(() => restoredData() || liveData() || state.streamedData);
  const isStreaming = () => hydrating() || (boundLive() ? live.isStreaming() : state.isStreaming);
  const streamError = () => (boundLive() ? live.error() : state.error);

  const results = createMemo(() => unwrapDomainResults(effectiveData(), props.domain));
  const cityData = createMemo(() => results()?.city ?? effectiveData()?.general_city_data);
  const resolvedCity = () => cityData()?.city || cityName();
  const list = createMemo<POIDetailedInfo[]>(() => results()?.list ?? []);
  const extras = createMemo<POIDetailedInfo[]>(() => results()?.extras ?? []);
  const title = () => listTitle(props.domain, resolvedCity());

  // The city the server resolved, once it is known: the URL, the share
  // text and the offline copy all read it from here.
  createEffect(
    on(
      () => cityData()?.city,
      (city) => {
        if (city && !cityName()) setCityName(city);
      },
    ),
  );

  const enrichedCount = createMemo(
    () => list().filter((poi) => poi.images?.[0] || poi.image_credits?.[0] || poi.id).length,
  );
  const phase = createMemo<"skeleton" | "enriching" | "done" | "error">(() => {
    if (streamError() && list().length === 0) return "error";
    if (list().length === 0) return "skeleton";
    if (isStreaming()) return "enriching";
    return "done";
  });
  const progress = createMemo(() =>
    list().length === 0 ? 0 : Math.round((enrichedCount() / list().length) * 100),
  );

  // Live alerts for the destination; the same query LocalWeather runs, so
  // TanStack serves both from one fetch.
  const localContext = useLocalContext(
    () => cityData()?.center_latitude,
    () => cityData()?.center_longitude,
  );
  const alerts = () => localContext.data?.alerts ?? [];
  const locatedAlertCount = () => alerts().filter(isLocatedAlert).length;

  // Map pins: the list numbered in one colour (they are all "today"), then
  // the extras unnumbered in the ungrouped grey. No routes: a list has no
  // walking order, so the map is told not to draw one and the legend not to
  // offer one.
  const mapPois = createMemo<POI[]>(() => {
    const out: POI[] = [];
    const seen = new Set<string>();
    const push = (poi: POIDetailedInfo, day?: number) => {
      if (seen.has(poi.name)) return;
      seen.add(poi.name);
      out.push({
        id: poi.id || poi.name,
        name: poi.name,
        category: poi.category || "",
        latitude: toNum(poi.latitude),
        longitude: toNum(poi.longitude),
        day,
        seq: out.length + 1,
        rating: poi.rating,
        timeToSpend: poi.time_to_spend,
        budget: poi.budget,
        priority: poi.priority,
      });
    };
    list().forEach((poi) => push(poi, LIST_DAY));
    extras().forEach((poi) => push(poi));
    return out;
  });

  const byName = createMemo(() => {
    const m = new Map<string, POIDetailedInfo>();
    [...list(), ...extras()].forEach((p) => m.set(p.name, p));
    return m;
  });

  // Shared selection between list and map (keyed by place name — the map
  // indexes its features by name).
  const [selectedId, setSelectedId] = createSignal<string | undefined>(undefined);
  const [detailItem, setDetailItem] = createSignal<any | null>(null);
  const [detailOpen, setDetailOpen] = createSignal(false);

  const detailType = () =>
    props.domain === "hotels"
      ? "hotel"
      : props.domain === "restaurants"
        ? "restaurant"
        : "activity";

  const openDetail = (poi: POIDetailedInfo) => {
    setDetailItem({
      type: detailType(),
      id: poi.id,
      name: poi.name,
      latitude: toNum(poi.latitude),
      longitude: toNum(poi.longitude),
      category: poi.category,
      description_poi: poi.description_poi || poi.description,
      grounded: poi.grounded,
      address: poi.address,
      website: poi.website,
      phone_number: poi.phone_number,
      opening_hours: poi.opening_hours,
      rating: poi.rating,
      price_range: poi.price_range || poi.price_level,
      cuisine_type: poi.cuisine_type,
      amenities: poi.amenities,
      budget: poi.budget,
      timeToSpend: poi.time_to_spend,
      priority: poi.priority,
      distance: typeof poi.distance === "number" && poi.distance > 0 ? poi.distance : undefined,
      tags: poi.tags,
      image_credits: poi.image_credits,
    });
    setDetailOpen(true);
  };

  const onCardSelect = (poi: POIDetailedInfo, _stop: ItineraryStop) => {
    setSelectedId(poi.name);
    openDetail(poi);
  };

  const handleDownload = () => {
    const data = JSON.stringify(effectiveData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.domain}-${resolvedCity() || "loci"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharePayload = createMemo<SharePayload>(() => ({
    cityName: resolvedCity(),
    title: title(),
    description: cityData()?.description,
    // The Loci home, not this page: this URL names a private session nobody
    // else can open. See src/lib/share.ts.
    url: SHARE_HOME_URL,
    stopCount: list().length,
    items: list().map((p) => p.name),
  }));

  const tripKitStops = createMemo<TripStop[]>(() =>
    list().map((poi) => ({
      name: poi.name,
      latitude: toNum(poi.latitude) || undefined,
      longitude: toNum(poi.longitude) || undefined,
      address: poi.address,
      category: poi.category,
      blurb: poi.description_poi || poi.description,
      timeToSpend: poi.time_to_spend,
      day: LIST_DAY,
      durationMinutes: LIST_STOP_MINUTES,
    })),
  );

  const [saving, setSaving] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal("");
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const showStatus = (text: string) => {
    setSaveStatus(text);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => setSaveStatus(""), 4000);
  };

  // One Save, as on /itinerary: the device copy first (it is what makes the
  // list open with no network), then the account bookmark when signed in.
  const handleSave = async () => {
    const sessionId = (searchParams.sessionId as string) || results()?.sessionId;
    const data = effectiveData();
    if (!sessionId || !data || list().length === 0) {
      showStatus("Nothing to save yet");
      return;
    }
    const city = cityData();
    setSaving(true);
    try {
      await saveItineraryOffline({
        id: sessionId,
        cityName: resolvedCity() || "Unknown",
        title: title(),
        description: city?.description,
        payload: data,
        stopCount: list().length,
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

    if (!isAuthenticated() || !resolvedCity()) {
      showStatus("Saved on this device");
      setSaving(false);
      return;
    }
    try {
      await saveItineraryMutation.mutateAsync({
        primary_city_name: resolvedCity(),
        title: title(),
        description: city?.description || `${title()}, saved from Loci`,
        tags: [props.domain],
        is_public: false,
      });
      showStatus("Saved on this device and to your account");
    } catch (error) {
      console.error("Failed to bookmark list:", error);
      showStatus("Saved on this device · account sync failed");
    } finally {
      setSaving(false);
    }
  };

  const toolbar = () => (
    <ActionToolbar
      onDownload={handleDownload}
      onSave={() => void handleSave()}
      isSaved={savedOffline()}
      saving={saving()}
      status={saveStatus()}
      sharePayload={sharePayload()}
    />
  );

  const MapContent = (
    <div class="h-full w-full bg-muted relative">
      <Show
        when={mapPois().length > 0}
        fallback={
          <div class="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {isStreaming()
              ? "Loading map data..."
              : streamError()
                ? `Could not load the ${meta().label.toLowerCase()} map`
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
          onActivate={(poi) => {
            const full = byName().get(poi.name);
            if (full) openDetail(full);
          }}
          alerts={alerts()}
          showAlerts={layers().alerts}
          showStops={layers().stops}
          showRoutes={false}
          fullBleed
        />
      </Show>

      <div class="pointer-events-none absolute bottom-4 left-4 z-10 hidden md:block">
        <LayerLegend
          value={layers()}
          onChange={setLayers}
          alertCount={locatedAlertCount()}
          hasRoutes={false}
          stopLabel={meta().stopLabel}
        />
      </div>

      {/* On a phone the toolbar sits above the list instead, where the map
          card's tap target does not cover it. */}
      <div class="absolute top-4 left-4 z-10 hidden md:block">{toolbar()}</div>
    </div>
  );

  const ListContent = (
    <div class="md:h-full md:overflow-y-auto px-4 py-6 md:px-8 bg-background">
      <div class="max-w-3xl mx-auto pb-24">
        <div class="mb-4 md:hidden">{toolbar()}</div>

        <CityInfoHeader cityData={cityData()} isLoading={isStreaming() && !cityData()} />

        <Show when={cityData()?.center_latitude}>
          <div class="mt-3 mb-6 space-y-3">
            <LocalWeather
              latitude={cityData()?.center_latitude}
              longitude={cityData()?.center_longitude}
            />
            <TripMoney
              latitude={cityData()?.center_latitude}
              longitude={cityData()?.center_longitude}
            />
          </div>
        </Show>

        <Show when={streamError()}>
          <StreamErrorCard
            error={streamError()!}
            title={`Unable to load ${meta().label.toLowerCase()}`}
            onRetry={startOrExplain}
          />
        </Show>

        <header class="mb-4">
          <p class="kicker mb-2">Your {meta().label.toLowerCase()}</p>
          <h1 class="editorial-title text-2xl sm:text-3xl text-foreground">
            {meta().emoji} {title()}
            <Show when={list().length > 0}>
              <span class="ml-2 text-base font-normal text-muted-foreground">
                ({list().length})
              </span>
            </Show>
          </h1>
        </header>

        {/* ---- Status rail ------------------------------------- */}
        <Show when={phase() === "skeleton" || phase() === "enriching"}>
          <div class="mb-4 flex items-center gap-3">
            <div
              class="flex-1 stream-rail"
              classList={{ "stream-rail-indeterminate": enrichedCount() === 0 }}
            >
              <div class="stream-rail-fill" style={{ width: `${progress()}%` }} />
            </div>
            <span class="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5 shrink-0">
              <Sparkles class="w-3.5 h-3.5 text-accent animate-pulse" />
              <Show when={list().length > 0} fallback={meta().searching}>
                {enrichedCount() >= list().length
                  ? "Finishing up…"
                  : `Adding photos ${enrichedCount()}/${list().length}`}
              </Show>
            </span>
          </div>
        </Show>
        <Show when={phase() === "done"}>
          <p class="mb-4 text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <Check class="w-3.5 h-3.5 text-accent" /> {list().length}{" "}
            {list().length === 1 ? meta().singular : meta().label.toLowerCase()} ready
          </p>
        </Show>

        <Show when={phase() === "skeleton" && !streamError()}>
          <div class="space-y-3">
            <For each={Array(4).fill(0)}>{(_, i) => <StopCardSkeleton index={i()} />}</For>
          </div>
        </Show>

        <Show when={list().length > 0}>
          <ResultsList
            pois={list()}
            domain={props.domain}
            cityName={resolvedCity()}
            selectedKey={selectedId()}
            onSelect={onCardSelect}
          />
        </Show>

        <Show when={phase() === "done" && list().length === 0 && !streamError()}>
          <div class="loci-card rounded-2xl p-6 text-center space-y-3 mt-4">
            <p class="font-display text-xl text-foreground">
              No {meta().label.toLowerCase()} found for this search
            </p>
            <p class="text-sm text-muted-foreground">Try a different phrasing or another area.</p>
            <button type="button" class="loci-hero__action mx-auto" onClick={startOrExplain}>
              Search again
            </button>
          </div>
        </Show>

        <TripKit
          title={title()}
          cityName={resolvedCity()}
          summary={cityData()?.description}
          stops={tripKitStops()}
          isPro={isPro()}
          planState={planState()}
          visible={list().length > 0 && !isStreaming()}
          stopsPerDay={Math.max(list().length, 1)}
          note={`A one-day list: every ${meta().singular} here is on Day 1, so the free plan exports all of it.`}
        />

        <Show when={extras().length > 0}>
          <div class="mt-10">
            <SectionHeader
              kicker="Also nearby"
              title="More to explore"
              subtitle={`Other places Loci found around these ${meta().label.toLowerCase()}`}
            />
            <ResultsList
              pois={extras()}
              domain="activities"
              cityName={resolvedCity()}
              selectedKey={selectedId()}
              onSelect={onCardSelect}
              startIndex={list().length}
            />
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <>
      <SplitView
        listContent={ListContent}
        mapContent={MapContent}
        initialMode="split"
        mobile="hero"
      />
      <Show when={detailOpen()}>
        <DetailedItemModal
          item={detailItem()}
          isOpen={detailOpen()}
          onClose={() => setDetailOpen(false)}
        />
      </Show>
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
