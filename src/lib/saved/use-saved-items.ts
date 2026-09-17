// One hook behind /saved: favourites from the account, itineraries from the
// account and from this device, folded into a single list of rows.
import { createMemo, createResource } from "solid-js";
import { useAuth } from "~/contexts/AuthContext";
import { useFavoritesList } from "~/lib/api/favorites";
import { useAllUserItineraries } from "~/lib/api/itineraries";
import { listOfflineItineraries, type OfflineItinerary } from "~/lib/itinerary-offline-store";
import { mergeSavedItineraries } from "~/lib/saved-itineraries";
import { countSaved, itinerariesToSaved, placesToSaved, sortSaved } from "./collect";
import type { SavedErrors, SavedItem, SavedStatus } from "./types";

export function useSavedItems() {
  const { isAuthenticated } = useAuth();

  // Both queries are enabled by an accessor so they run once auth settles,
  // not only if auth happened to be known when the page mounted.
  const favoritesQuery = useFavoritesList({ enabled: () => isAuthenticated() });
  const itinerariesQuery = useAllUserItineraries({ enabled: () => isAuthenticated() });

  // Device copies do not need an account, and must still list when signed out.
  const [offline] = createResource<OfflineItinerary[]>(
    () => listOfflineItineraries().catch(() => []),
    { initialValue: [] },
  );

  // Guarded reads: touching `.data` while a query is pending suspends up to the
  // app-wide <Suspense>, which would flash the whole route.
  const favorites = () => (favoritesQuery.isSuccess ? (favoritesQuery.data?.favorites ?? []) : []);
  const cloud = () =>
    itinerariesQuery.isSuccess ? (itinerariesQuery.data?.itineraries ?? []) : [];

  const items = createMemo<SavedItem[]>(() =>
    sortSaved([
      ...placesToSaved(favorites()),
      ...itinerariesToSaved(mergeSavedItineraries(offline(), cloud())),
    ]),
  );

  const counts = createMemo(() => countSaved(items()));

  const errors = createMemo<SavedErrors>(() => ({
    places: favoritesQuery.isError ? favoritesQuery.error : undefined,
    itineraries: itinerariesQuery.isError ? itinerariesQuery.error : undefined,
  }));

  /**
   * A partial failure is not a failure: device copies survive a dead account,
   * and favourites survive a dead bookmarks call. "error" is reserved for
   * having nothing to show AND a reason why.
   */
  const status = createMemo<SavedStatus>(() => {
    if (offline.loading) return "loading";
    if (!isAuthenticated()) return offline().length > 0 ? "ready" : "signed-out";
    if (favoritesQuery.isLoading || itinerariesQuery.isLoading) return "loading";
    const failed = favoritesQuery.isError && itinerariesQuery.isError;
    if (failed && items().length === 0) return "error";
    return "ready";
  });

  return { items, counts, status, errors };
}
