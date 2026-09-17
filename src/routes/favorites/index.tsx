import { Navigate } from "@solidjs/router";

/**
 * Favourites were folded into /saved, which shows them alongside saved
 * itineraries. Kept as a redirect: the path is in people's history, in the
 * error boundary's suggestions, and in older share links.
 */
export default function FavoritesRedirect() {
  return <Navigate href="/saved?view=places" />;
}
