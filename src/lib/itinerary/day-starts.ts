/* How each day of a trip begins from the stay in its city, for the itinerary
   page. Loaded imperatively into a signal, like the trip itself there
   (createTripView): reading a solid-query `.data` on that route suspends to
   the app-wide Suspense and blanks the page. */

import { createEffect, createSignal, on } from "solid-js";
import type { DayStart } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { fetchStayTransport } from "@/lib/api/trip-plan";
import type { Trip } from "@/lib/api/trips";

type Fetch = typeof fetchStayTransport;

/**
 * Day id to its "from your hotel" line. Refetched whenever the trip's version
 * moves, since a new stay or a new first stop changes the answer. A stay
 * whose transport cannot be read simply has no lines.
 */
export function createDayStarts(trip: () => Trip | undefined, fetch: Fetch = fetchStayTransport) {
  const [starts, setStarts] = createSignal<Record<string, DayStart>>({});
  // A load that finishes after a newer one started must not win.
  let seq = 0;

  createEffect(
    on(
      () => {
        const t = trip();
        return t ? `${t.id}:${t.version}:${t.stays.map((s) => s.cityName).join("|")}` : "";
      },
      async () => {
        const t = trip();
        const mine = ++seq;
        if (!t || t.stays.length === 0) {
          setStarts({});
          return;
        }
        const loaded = await Promise.all(
          t.stays.map((stay) => fetch(t.id, stay.cityName).catch(() => null)),
        );
        if (mine !== seq) return;
        const next: Record<string, DayStart> = {};
        for (const transport of loaded) {
          for (const start of transport?.dayStarts ?? []) next[start.dayId] = start;
        }
        setStarts(next);
      },
    ),
  );

  return starts;
}
