import { Navigate } from "@solidjs/router";

/** Saved itineraries were folded into /saved. See favorites/index.tsx. */
export default function BookmarksRedirect() {
  return <Navigate href="/saved?view=itineraries" />;
}
