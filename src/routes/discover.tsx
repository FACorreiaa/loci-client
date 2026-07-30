import { createSignal, For, Show, onCleanup, createEffect, onMount } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { useUserLocation } from "~/contexts/LocationContext";
import {
  Search,
  TrendingUp,
  Star,
  Sparkles,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Smartphone,
  Utensils,
  Bed,
  Target,
  Landmark,
  Moon,
  ShoppingBag,
  Palette,
  Trees,
  Waves,
  Mountain,
  Drama,
  Store,
} from "lucide-solid";
import WhyThisStop from "~/components/poi/WhyThisStop";
import { deriveWhyThis } from "~/lib/why-this";
import { useDiscoverPageData, fetchRecentDiscoveries } from "~/lib/api/discover";
import type { TrendingDiscovery, POI, DomainType, ChatSession } from "~/lib/api/types";
import { useAuth } from "~/contexts/AuthContext";
import RegisterBanner from "~/components/ui/RegisterBanner";
import { streamChatEvents } from "~/lib/streaming/chatStream";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { Button } from "~/ui/button";
import { useSelection, type SelectionItem } from "~/lib/hooks/useSelection";
import { SelectionToolbar } from "~/components/ui/SelectionToolbar";
import { exportPOIsToPDF } from "~/lib/utils/pdf-export";
import EditTripCTA from "~/components/trip/EditTripCTA";
import AddToTripButton from "~/components/trip/AddToTripButton";
import AdvancedFiltersBar, {
  advancedFilterPromptSuffix,
  type AdvancedFilterId,
} from "~/components/filters/AdvancedFiltersBar";
import { useUserSubscription } from "~/lib/api/billing";
import { isProPlan } from "~/lib/subscription";
import {
  normalizeRecommendationTrace,
  recordRecommendationEvents,
} from "~/lib/api/recommendations";

export default function DiscoverPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const { userLocation, requestLocation } = useUserLocation();
  const subscriptionQuery = useUserSubscription(() => !!isAuthenticated());
  const isPro = () => isProPlan(subscriptionQuery.data?.plan);
  const localResultCache = new Map<string, POI[]>();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchLocation, setSearchLocation] = createSignal("");
  const [isNearbyMode, setIsNearbyMode] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<POI[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [progressMessage, setProgressMessage] = createSignal<string | null>(null);
  const [streamDomain, setStreamDomain] = createSignal<DomainType>("general");
  const [localTrending, setLocalTrending] = createSignal<TrendingDiscovery[]>([]);
  const [recentSessions, setRecentSessions] = createSignal<ChatSession[]>([]);
  const [recentPage, setRecentPage] = createSignal(1);
  const [recentHasMore, setRecentHasMore] = createSignal(true);
  const [recentLoadingMore, setRecentLoadingMore] = createSignal(false);
  const [persistedTripId, setPersistedTripId] = createSignal<string | null>(null);
  const [persistedTripCity, setPersistedTripCity] = createSignal<string>("");
  const [advancedFilters, setAdvancedFilters] = createSignal<AdvancedFilterId[]>([]);

  // Selection state for search results
  const selection = useSelection<SelectionItem>();

  let abortController: AbortController | null = null;

  // Fetch discover page data (RPC)
  const discoverData = useDiscoverPageData(() => !!isAuthenticated());

  // Category data matching go-templui
  const categories = [
    { name: "Restaurants", icon: Utensils, category: "restaurant" },
    { name: "Hotels", icon: Bed, category: "hotel" },
    { name: "Activities", icon: Target, category: "activity" },
    { name: "Attractions", icon: Landmark, category: "attraction" },
    { name: "Nightlife", icon: Moon, category: "nightlife" },
    { name: "Shopping", icon: ShoppingBag, category: "shopping" },
    { name: "Museums", icon: Palette, category: "museum" },
    { name: "Parks", icon: Trees, category: "park" },
    { name: "Beaches", icon: Waves, category: "beach" },
    { name: "Adventure", icon: Mountain, category: "adventure" },
    { name: "Cultural", icon: Drama, category: "cultural" },
    { name: "Markets", icon: Store, category: "market" },
  ];

  const deliveredTraceKeys = new Set<string>();

  const normalizePoi = (poi: any): POI => ({
    id: poi.id || poi.llm_interaction_id || poi.name,
    name: poi.name || "Unknown",
    category: poi.category || "place",
    description: poi.description || poi.description_poi || poi.descriptionPoi || "",
    description_poi: poi.description_poi || poi.descriptionPoi,
    latitude: poi.latitude ?? 0,
    longitude: poi.longitude ?? 0,
    rating: poi.rating ?? 0,
    tags: poi.tags || [],
    address: poi.address || "",
    website: poi.website,
    phone_number: poi.phone_number || poi.phoneNumber,
    opening_hours: poi.opening_hours || poi.openingHours,
    price_level: poi.price_level || poi.priceLevel || "",
    price_range: poi.price_range || poi.priceRange,
    distance: poi.distance,
    city: poi.city || poi.city_name,
    city_id: poi.city_id || poi.cityId,
    recommendation_rationale: poi.recommendation_rationale || poi.recommendationRationale,
    uncertainty_score: poi.uncertainty_score ?? poi.uncertaintyScore,
    missing_data: poi.missing_data ?? poi.missingData,
    llm_interaction_id: poi.llm_interaction_id,
    created_at: poi.created_at,
    recommendation_trace: normalizeRecommendationTrace(
      poi.recommendation_trace || poi.recommendationTrace,
    ),
  });

  const attributeResults = (rawPOIs: any[]) => {
    const list = rawPOIs.map(normalizePoi);
    const newlyDelivered = list.filter((poi) => {
      const trace = poi.recommendation_trace;
      if (!trace) return false;
      const key = `${trace.runId}:${trace.itemId}`;
      if (deliveredTraceKeys.has(key)) return false;
      deliveredTraceKeys.add(key);
      return true;
    });
    void recordRecommendationEvents(
      newlyDelivered.flatMap((poi) => [
        {
          eventType: "RECOMMENDATION_EVENT_TYPE_DELIVERED" as const,
          trace: poi.recommendation_trace!,
          poiId: poi.id,
        },
        {
          eventType: "RECOMMENDATION_EVENT_TYPE_PRESENTED" as const,
          trace: poi.recommendation_trace!,
          poiId: poi.id,
        },
      ]),
    );
    return list;
  };

  const recordPoiOutcome = (
    poi: POI,
    eventType: "RECOMMENDATION_EVENT_TYPE_OPENED" | "RECOMMENDATION_EVENT_TYPE_DISMISSED",
  ) => {
    if (!poi.recommendation_trace) return;
    void recordRecommendationEvents([
      { eventType, trace: poi.recommendation_trace, poiId: poi.id },
    ]);
  };

  const dismissPoi = (poi: POI) => {
    recordPoiOutcome(poi, "RECOMMENDATION_EVENT_TYPE_DISMISSED");
    setSearchResults((current) => current.filter((item) => item.id !== poi.id));
  };

  const handleSearch = async (e?: Event) => {
    e?.preventDefault();
    if (!searchQuery().trim()) return;
    const filterSuffix = isPro() ? advancedFilterPromptSuffix(advancedFilters()) : "";
    const message = `${searchQuery().trim()}${filterSuffix}`;
    const cacheKey = `${streamDomain()}:${message.toLowerCase()}:${searchLocation().trim().toLowerCase()}`;

    if (localResultCache.has(cacheKey)) {
      setSearchResults(localResultCache.get(cacheKey) || []);
      setSearchError(null);
      setProgressMessage("Loaded from cache");
      setIsSearching(false);
      return;
    }

    if (abortController) {
      abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    setSearchError(null);
    setIsSearching(true);
    setProgressMessage("Starting discover stream...");
    setSearchResults([]);
    setPersistedTripId(null);
    setPersistedTripCity("");

    try {
      const loc = userLocation();
      // Single canonical reader — typed events, no SSE/byte parsing.
      for await (const event of streamChatEvents(
        {
          profileId: "",
          cityName: searchLocation().trim() || undefined,
          message,
          // Pass location when available so the server can serve the "nearby"
          // domain (it requires user coordinates).
          userLocation: loc ? { userLat: loc.latitude, userLon: loc.longitude } : undefined,
        },
        controller.signal,
      )) {
        switch (event.kind) {
          case "start":
            setProgressMessage("Detecting what you need...");
            if (event.domain) setStreamDomain(event.domain as DomainType);
            break;
          case "progress":
          case "token":
          case "partial":
            setProgressMessage("Thinking...");
            break;
          case "city_data":
            setProgressMessage("Mapping the city context...");
            break;
          case "general_pois":
          case "restaurants":
          case "hotels":
          case "activities": {
            const list = attributeResults(event.pois);
            setSearchResults(list);
            localResultCache.set(cacheKey, list);
            setProgressMessage("Found places you might like");
            break;
          }
          case "itinerary": {
            const pois = attributeResults(event.cityResponse.points_of_interest || []);
            if (pois.length > 0) setSearchResults(pois);
            setProgressMessage("Drafting an itinerary...");
            break;
          }
          case "complete": {
            if (event.navigation?.routeType) {
              setStreamDomain(event.navigation.routeType as DomainType);
            }
            if (event.tripId) {
              setPersistedTripId(event.tripId);
              setPersistedTripCity(
                event.navigation?.queryParams?.cityName ||
                  searchLocation().trim() ||
                  searchQuery().trim() ||
                  "",
              );
            }
            const sessionId =
              event.navigation?.queryParams?.sessionId || event.sessionId || crypto.randomUUID();
            const cityName =
              event.navigation?.queryParams?.cityName ||
              searchLocation().trim() ||
              searchQuery().trim() ||
              "Unknown City";
            const newSession: ChatSession = {
              id: sessionId,
              profile_id: "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              city_name: cityName,
              conversation_history: [],
            } as any;
            setRecentSessions((prev) => {
              const map = new Map(prev.map((s) => [s.id, s]));
              map.set(newSession.id, newSession);
              return Array.from(map.values()).sort((a, b) =>
                (b.created_at || "").localeCompare(a.created_at || ""),
              );
            });
            setRecentHasMore(true);
            setLocalTrending((prev) => {
              const base = prev.length > 0 ? [...prev] : [...(discoverData.data?.trending || [])];
              const idx = base.findIndex(
                (t) => t.city_name.toLowerCase() === cityName.toLowerCase(),
              );
              if (idx >= 0) {
                base[idx] = { ...base[idx], search_count: (base[idx].search_count || 0) + 1 };
              } else {
                base.unshift({
                  city_name: cityName,
                  search_count: 1,
                  emoji: "🗺️",
                  category: "",
                  first_message: "",
                } as TrendingDiscovery);
              }
              return base;
            });
            setIsSearching(false);
            setProgressMessage(null);
            break;
          }
          case "error": {
            const rawError = event.userMessage || "Something went wrong";
            const friendlyError =
              event.retryAfterMs || /quota|high traffic|resource_exhausted|429/i.test(rawError)
                ? "Our AI travel guide is currently experiencing high traffic. Please try again in a few moments."
                : rawError;
            setSearchError(friendlyError);
            setIsSearching(false);
            setProgressMessage(null);
            break;
          }
        }
      }
      /*\u0000/g, "").trim();
      legacy SSE parser removed — see git history
      */
    } catch (err: any) {
      console.error("Discover search failed", err);
      if (err?.name !== "AbortError") {
        const friendly =
          err?.code === "aborted" || err?.name === "AbortError"
            ? "Search was canceled."
            : "We lost connection while searching. Please try again.";
        setSearchError(friendly);
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setProgressMessage(null);
      abortController = null;
    }
  };

  const handleCategoryClick = (category: string, name: string) => {
    setSearchQuery(name);
    // Focus on search input after category selection
    const searchInput = document.getElementById("discover-search-input");
    if (searchInput) {
      searchInput.focus();
    }
  };

  const handleTrendingClick = (trending: TrendingDiscovery) => {
    setSearchLocation(trending.city_name);
    const searchInput = document.getElementById("discover-search-input");
    if (searchInput) {
      searchInput.focus();
    }
  };

  // Geolocation-driven "near me" search. Reused by the ?category=nearby entry
  // point (e.g. the dashboard "Discover Nearby" button).
  const triggerNearbySearch = async () => {
    setIsNearbyMode(true);
    if (!userLocation()) {
      setProgressMessage("Getting your location…");
      try {
        await requestLocation();
      } catch {
        // fall through to the guard below
      }
    }
    if (!userLocation()) {
      setSearchError(
        "Location access is needed to find places near you. Please enable location services and try again.",
      );
      setProgressMessage(null);
      return;
    }
    setSearchQuery("Interesting places near me");
    await handleSearch();
  };

  onMount(() => {
    if (searchParams.category === "nearby") {
      void triggerNearbySearch();
    }
  });

  onCleanup(() => {
    if (abortController) {
      abortController.abort();
    }
  });

  const fallbackTrending: TrendingDiscovery[] = [
    { city_name: "Lisbon", search_count: 128, emoji: "🌊" },
    { city_name: "Barcelona", search_count: 102, emoji: "🌆" },
    { city_name: "Tokyo", search_count: 96, emoji: "🍜" },
  ];

  const trendingList = () => {
    const base =
      discoverData.data?.trending ||
      (discoverData.data as any)?.data?.trending ||
      (discoverData.isError ? fallbackTrending : []);
    const local = localTrending();
    return local.length > 0 ? local : base;
  };
  const featuredList = () =>
    discoverData.data?.featured || (discoverData.data as any)?.data?.featured || [];
  const recentList = () =>
    discoverData.data?.recent_discoveries ||
    (discoverData.data as any)?.data?.recent_discoveries ||
    [];

  createEffect(() => {
    // Seed recents from initial page data
    const recents = recentList() || [];
    setRecentSessions(recents);
    setRecentPage(1);
    // Optimistic hasMore: if we filled a whole page, we can probably load more
    setRecentHasMore(recents.length >= 10);
    const trendingSeed =
      discoverData.data?.trending || (discoverData.data as any)?.data?.trending || [];
    setLocalTrending(trendingSeed);
  });

  const loadMoreRecents = async () => {
    if (recentLoadingMore() || !recentHasMore()) return;
    setRecentLoadingMore(true);
    const nextPage = recentPage() + 1;
    try {
      const { sessions, pagination } = await fetchRecentDiscoveries(nextPage, 10);
      if (sessions.length > 0) {
        const existing = new Map(recentSessions().map((s) => [s.id, s]));
        sessions.forEach((s) => existing.set(s.id, s));
        setRecentSessions(Array.from(existing.values()));
        setRecentPage(nextPage);
      }
      const hasMore = pagination?.has_more ?? sessions.length >= 10;
      setRecentHasMore(hasMore);
    } catch (err) {
      console.error("Failed to load more recent discoveries", err);
      setRecentHasMore(false);
    } finally {
      setRecentLoadingMore(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Just now";
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  console.log("search results", searchResults());

  return (
    <>
      <Title>Discover - Trending Cities & AI-Curated Travel Experiences | Loci</Title>
      <Meta
        name="description"
        content="Explore trending destinations, featured collections, and AI-curated travel experiences. Search for restaurants, hotels, activities, and attractions with intelligent recommendations."
      />
      <Meta
        name="keywords"
        content="travel discovery, trending cities, travel search, featured collections, AI recommendations, restaurants, hotels, activities, travel trends"
      />
      <Meta property="og:title" content="Discover - Trending Cities & Curated Experiences | Loci" />
      <Meta
        property="og:description"
        content="Explore trending destinations and AI-curated travel collections. Search for the perfect restaurants, hotels, and activities."
      />
      <Meta property="og:url" content="https://loci.app/discover" />
      <Meta name="twitter:title" content="Discover - Trending Travel Experiences | Loci" />
      <Meta
        name="twitter:description"
        content="Explore trending cities and AI-curated collections for restaurants, hotels, and activities."
      />
      <link rel="canonical" href="https://loci.app/discover" />

      <div class="min-h-screen relative transition-colors">
        {/* Header */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="loci-hero">
            <div class="loci-hero__content p-6 sm:p-8 space-y-6">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div class="absolute -inset-1 hero-glow blur-md opacity-80" />
                  <div class="loci-hero__icon">
                    <Sparkles class="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">Discover</h1>
                  <p class="loci-hero__subtitle text-sm mt-1">
                    AI-curated routes, fresh drops, and local pulse in one place.
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div class="loci-card rounded-2xl p-6">
                <form onSubmit={handleSearch} class="relative">
                  <div class="flex flex-col md:flex-row gap-4">
                    <div class="flex-1 relative">
                      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                      <input
                        id="discover-search-input"
                        type="text"
                        placeholder="What are you looking for? (e.g., 'best ramen in Tokyo')"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border focus:ring-2 focus:ring-ring focus:border-ring bg-card/95 text-foreground placeholder:text-muted-foreground text-base transition-all"
                      />
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        placeholder="Location (optional)"
                        value={searchLocation()}
                        onInput={(e) => setSearchLocation(e.currentTarget.value)}
                        class="px-4 py-3 rounded-xl border-2 border-border focus:ring-2 focus:ring-ring focus:border-ring bg-card/95 text-foreground placeholder:text-muted-foreground w-40 md:w-48 backdrop-blur transition-all"
                      />
                      <Button type="submit" disabled={!searchQuery().trim()} class="gap-2">
                        <Search class="w-5 h-5" />
                        Search
                      </Button>
                    </div>
                  </div>
                </form>
                <div class="mt-4">
                  <AdvancedFiltersBar
                    isPro={isPro()}
                    active={advancedFilters()}
                    onChange={setAdvancedFilters}
                  />
                </div>
                <Show when={progressMessage()}>
                  <p class="mt-3 text-sm text-primary font-medium">{progressMessage()}</p>
                </Show>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <a href="/compare" class="loci-hero__action text-sm">
                  Weekend: compare two cities
                </a>
                <span class="text-xs text-muted-foreground">e.g. Évora vs Beja from Porto</span>
              </div>
              <Show when={discoverData.isError}>
                <p class="text-sm loci-hero__subtitle">
                  Couldn’t reach the discover service, showing sample data.{" "}
                  {(discoverData.error as any)?.message || "offline"}
                </p>
              </Show>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
          {/* Search Results */}
          <Show when={searchResults().length > 0 || isSearching() || searchError()}>
            <div class="mb-10">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-semibold text-foreground">Search Results</h2>
                <p class="text-sm text-muted-foreground">
                  {progressMessage() ||
                    (isSearching() ? "Searching..." : `${searchResults().length} places`)}
                </p>
              </div>
              <Show when={searchResults().length > 0}>
                <div class="text-xs text-primary mb-3">Mode: {streamDomain()}</div>
              </Show>
              <EditTripCTA tripId={persistedTripId()} cityName={persistedTripCity()} />
              <Show when={searchError()}>
                <p class="text-sm text-destructive mb-3">{searchError()}</p>
              </Show>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Show
                  when={!isSearching()}
                  fallback={
                    <div class="md:col-span-2 lg:col-span-3 space-y-3">
                      <For each={[1, 2, 3]}>
                        {() => <div class="h-24 rounded-xl bg-muted animate-pulse" />}
                      </For>
                    </div>
                  }
                >
                  <Show
                    when={searchResults().length > 0}
                    fallback={
                      <div class="md:col-span-2 lg:col-span-3 text-center py-6 text-muted-foreground">
                        {isNearbyMode()
                          ? "No places found near you. Try a wider area or a specific city."
                          : "No results yet. Try another query."}
                      </div>
                    }
                  >
                    <For each={searchResults()}>
                      {(poi, index) => {
                        const itemForSelection: SelectionItem = {
                          id: poi.id || poi.name,
                          name: poi.name,
                          category: poi.category,
                          description: poi.description_poi || poi.description,
                          address: poi.address,
                          latitude: poi.latitude,
                          longitude: poi.longitude,
                          rating: poi.rating,
                        };
                        return (
                          <div
                            class={`loci-card-interactive stagger-animation rounded-xl p-4 ${selection.isSelected(poi.id || poi.name) ? "ring-2 ring-accent border-accent/40" : ""}`}
                            style={{ "animation-delay": `${Math.min(index(), 19) * 0.05}s` }}
                          >
                            <div class="flex items-start justify-between gap-3 mb-2">
                              <div class="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={selection.isSelected(poi.id || poi.name)}
                                  onChange={() => selection.toggleSelection(itemForSelection)}
                                  class="w-4 h-4 text-primary rounded border-border focus:ring-ring flex-shrink-0"
                                />
                                <div class="flex-1 min-w-0">
                                  <h3 class="text-base font-semibold text-foreground">
                                    {poi.name}
                                  </h3>
                                  <p class="text-xs font-medium text-muted-foreground">
                                    {poi.category || "Place"}
                                  </p>
                                </div>
                              </div>
                              <div class="flex items-center gap-2">
                                <FavoriteButton
                                  item={{
                                    id: poi.id || poi.name,
                                    name: poi.name,
                                    contentType: "poi",
                                    description: poi.description_poi || poi.description || "",
                                  }}
                                  size="sm"
                                  recommendationTrace={poi.recommendation_trace}
                                  poiId={poi.id}
                                />
                                <span class="loci-chip loci-chip--muted">
                                  {poi.city || "Unknown"}
                                </span>
                                <button
                                  type="button"
                                  class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onClick={() => dismissPoi(poi)}
                                  aria-label={`Dismiss ${poi.name}`}
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                            <p class="text-sm text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                              {poi.description_poi || poi.description || "No description provided."}
                            </p>
                            <WhyThisStop
                              reason={deriveWhyThis({
                                category: poi.category,
                                rating: poi.rating,
                                recommendation_rationale: poi.recommendation_rationale,
                                tags: poi.tags,
                              })}
                              uncertaintyScore={poi.uncertainty_score}
                              missingData={poi.missing_data}
                            />
                            <div class="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                              <div class="flex items-center gap-1">
                                <Star class="w-4 h-4 text-accent fill-current" />
                                <span class="font-medium">{poi.rating ?? "4.0"}</span>
                              </div>
                              <div class="flex items-center gap-1">
                                <MapPin class="w-4 h-4 text-primary" />
                                <span class="font-medium">{poi.city || "N/A"}</span>
                              </div>
                              <Show when={poi.website}>
                                <a
                                  href={poi.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  class="ml-auto font-medium text-primary hover:underline"
                                  onClick={() =>
                                    recordPoiOutcome(poi, "RECOMMENDATION_EVENT_TYPE_OPENED")
                                  }
                                >
                                  Open place
                                </a>
                              </Show>
                              <AddToTripButton poi={poi} />
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </Show>

          {/* Quick Categories */}
          <div class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-foreground">Quick Categories</h2>
              <p class="text-xs uppercase tracking-wider text-muted-foreground">Tap to auto-fill</p>
            </div>
            <div class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-3">
              <For each={categories}>
                {(cat) => (
                  <button
                    onClick={() => handleCategoryClick(cat.category, cat.name)}
                    class="loci-card-interactive p-3 rounded-xl group text-center min-h-[44px]"
                  >
                    <span class="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                      <cat.icon class="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span class="block text-xs font-semibold text-foreground">{cat.name}</span>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Main Content Grid */}
          <Show
            when={isAuthenticated()}
            fallback={
              <div class="space-y-6 my-8">
                <RegisterBanner
                  title="Sign in to see trending searches and your recent discoveries"
                  description="Search is open to everyone. Trending, recent history, and personalized highlights unlock once you register."
                  helper={
                    <p class="text-xs font-medium text-muted-foreground">
                      Stay in guest mode to search only.
                    </p>
                  }
                />
                <div class="rounded-2xl border border-border bg-primary/5 p-5 sm:p-6">
                  <div class="flex items-start gap-3">
                    <div class="p-3 rounded-xl bg-primary/10 text-primary border border-primary/30 shadow-sm">
                      <Smartphone class="w-5 h-5" />
                    </div>
                    <div class="space-y-2">
                      <p class="text-xs uppercase tracking-[0.16em] font-medium text-muted-foreground">
                        Native apps incoming
                      </p>
                      <h3 class="text-lg font-semibold text-foreground">
                        iOS + Android with paid-only perks
                      </h3>
                      <p class="text-sm text-foreground/85 leading-relaxed">
                        Join the waitlist to unlock offline brains, background updates twice daily,
                        and taste profiles synced across devices.
                      </p>
                      <div class="flex flex-wrap gap-2 text-xs">
                        <For
                          each={[
                            "Offline maps",
                            "Push nearby picks",
                            "Premium taste graph",
                            "Download itineraries",
                          ]}
                        >
                          {(chip) => (
                            <span class="px-2.5 py-1.5 rounded-full bg-card/90 dark:bg-white/10 border border-primary/30/60 text-foreground font-medium shadow-sm">
                              {chip}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Trending & Featured - Takes 2 columns */}
              <div class="lg:col-span-2 space-y-8">
                {/* Trending Now */}
                <div>
                  <h2 class="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp class="w-5 h-5 text-primary" />
                    Trending Now
                  </h2>
                  <Show
                    when={!discoverData.isLoading}
                    fallback={
                      <div class="space-y-3">
                        <For each={[1, 2, 3]}>
                          {() => <div class="animate-pulse bg-muted rounded-xl h-20" />}
                        </For>
                      </div>
                    }
                  >
                    <div class="space-y-3">
                      <Show
                        when={trendingList().length > 0}
                        fallback={
                          <p class="text-sm text-muted-foreground py-4 text-center">
                            No trending discoveries yet today
                          </p>
                        }
                      >
                        <For each={trendingList()}>
                          {(item, index) => (
                            <button
                              onClick={() => handleTrendingClick(item)}
                              class="w-full flex items-center gap-3 p-4 loci-card-interactive rounded-xl group"
                            >
                              <div class="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full text-sm font-bold shadow-sm">
                                {index() + 1}
                              </div>
                              <span class="text-2xl">{item.emoji}</span>
                              <div class="flex-1 text-left">
                                <p class="font-semibold text-foreground text-sm">
                                  {item.city_name}
                                </p>
                                <p class="text-xs font-medium text-muted-foreground">
                                  {item.search_count} searches today
                                </p>
                              </div>
                              <ChevronRight class="w-5 h-5 text-primary dark:text-primary group-hover:translate-x-1 transition-transform" />
                            </button>
                          )}
                        </For>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Featured Collections */}
                <div>
                  <h2 class="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Star class="w-5 h-5 text-accent fill-current" />
                    Featured Collections
                  </h2>
                  <Show
                    when={!discoverData.isLoading}
                    fallback={
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For each={[1, 2, 3, 4]}>
                          {() => <div class="animate-pulse bg-muted rounded-xl h-24" />}
                        </For>
                      </div>
                    }
                  >
                    <Show
                      when={featuredList().length > 0}
                      fallback={
                        <p class="text-sm text-muted-foreground py-4 text-center">
                          No featured collections available
                        </p>
                      }
                    >
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For each={featuredList()}>
                          {(item) => (
                            <button
                              onClick={() => handleCategoryClick(item.category, item.title)}
                              class="flex items-center gap-3 p-4 loci-card-interactive rounded-xl group"
                            >
                              <span class="text-3xl">{item.emoji}</span>
                              <div class="flex-1 text-left">
                                <p class="font-semibold text-foreground text-sm">{item.title}</p>
                                <p class="text-xs font-medium text-muted-foreground">
                                  {item.item_count} items
                                </p>
                              </div>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>

              {/* Recent Discoveries - Sidebar */}
              <div class="lg:col-span-1">
                <div class="sticky top-4">
                  <h2 class="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Clock class="w-5 h-5 text-muted-foreground" />
                    Recent Discoveries
                  </h2>
                  <Show
                    when={!discoverData.isLoading}
                    fallback={
                      <div class="space-y-3">
                        <For each={[1, 2, 3]}>
                          {() => <div class="animate-pulse bg-muted rounded-xl h-32" />}
                        </For>
                      </div>
                    }
                  >
                    <Show
                      when={recentSessions().length > 0}
                      fallback={
                        <div class="text-center py-8 bg-card rounded-xl border border-border">
                          <div class="text-4xl mb-3">🔍</div>
                          <p class="text-sm text-muted-foreground mb-2">
                            No recent discoveries yet
                          </p>
                          <p class="text-xs text-muted-foreground">
                            Start exploring to see your history
                          </p>
                        </div>
                      }
                    >
                      <div class="space-y-3">
                        <For each={recentSessions()}>
                          {(session) => (
                            <div class="loci-card-interactive rounded-xl p-4 cursor-pointer">
                              <div class="flex items-start gap-3 mb-3">
                                <span class="text-2xl">🗺️</span>
                                <div class="flex-1 min-w-0">
                                  <span class="loci-chip loci-chip--muted mb-2">Discovery</span>
                                  <h3 class="font-semibold text-foreground text-sm truncate">
                                    {session.city_name || "Unknown City"}
                                  </h3>
                                </div>
                              </div>
                              <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                                <Calendar class="w-3 h-3" />
                                <span>{formatDate(session.created_at)}</span>
                              </div>
                              <Show
                                when={
                                  (session as any).conversation_history &&
                                  (session as any).conversation_history.length > 0
                                }
                              >
                                <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {(session as any).conversation_history[0]?.content ||
                                    "No description"}
                                </p>
                              </Show>
                            </div>
                          )}
                        </For>
                        <Show when={recentHasMore()}>
                          <button
                            class="w-full mt-2 text-sm font-semibold text-primary px-3 py-2 rounded-lg border border-primary/30 bg-card hover:bg-primary/10 transition disabled:opacity-60"
                            onClick={loadMoreRecents}
                            disabled={recentLoadingMore()}
                          >
                            {recentLoadingMore() ? "Loading more..." : "Load more"}
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Selection Toolbar */}
      <SelectionToolbar
        count={selection.count()}
        onExport={() => exportPOIsToPDF(selection.getSelectedItems())}
        onClear={() => selection.clearSelection()}
        onSelectAll={() => {
          const items = searchResults().map((poi) => ({
            id: poi.id || poi.name,
            name: poi.name,
            category: poi.category,
            description: poi.description_poi || poi.description,
            address: poi.address,
            latitude: poi.latitude,
            longitude: poi.longitude,
            rating: poi.rating,
          }));
          selection.selectAll(items);
        }}
      />
    </>
  );
}
