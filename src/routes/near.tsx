import { Navigate } from "@solidjs/router";

/**
 * `/near` was an earlier, thinner version of the nearby-places page: 901 lines
 * whose only real feature was a map. `/nearme` supersedes it entirely —
 * geolocation with error recovery, distance options, split view, selection, PDF
 * export, the floating chat — and it is the one the nav links to.
 *
 * Nothing linked here except a preload map, so rather than maintain (and
 * restyle) a duplicate that would keep drifting, the URL redirects. Anyone
 * holding an old link still lands somewhere better.
 *
 * The original is kept at `_archive/near.tsx.bak` — outside the routes the
 * file-router picks up — until it is clearly not wanted.
 */
export default function NearRedirect() {
  return <Navigate href="/nearme" />;
}
