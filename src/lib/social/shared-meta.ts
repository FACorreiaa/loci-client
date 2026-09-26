// Link-preview metadata for a shared trip. Chat apps and social cards read
// the server-rendered <head> and never run our JavaScript, and the query layer
// skips fetches while rendering on the server, so the /t/:code page asks the
// API for this directly (Connect's JSON protocol, no auth: GetSharedTrip is
// public).

export interface SharedTripMeta {
  title: string;
  description: string;
}

interface WireStop {
  name?: string;
}
interface WireDay {
  stops?: WireStop[];
  cityName?: string;
}
interface WireTrip {
  title?: string;
  cityName?: string;
  days?: WireDay[];
  owner?: { displayName?: string; username?: string };
}

/** Builds the preview text from a GetSharedTrip JSON response. Pure. */
export const sharedTripMeta = (trip: WireTrip | undefined): SharedTripMeta | undefined => {
  if (!trip?.title) return undefined;
  const days = trip.days ?? [];
  const stops = days.flatMap((d) => d.stops ?? []);
  const cities = [
    ...new Set([trip.cityName, ...days.map((d) => d.cityName)].filter((c): c is string => !!c)),
  ];
  const who = trip.owner?.displayName || trip.owner?.username;
  const parts = [
    `${days.length} day${days.length === 1 ? "" : "s"}`,
    cities.length ? cities.slice(0, 3).join(", ") : undefined,
    `${stops.length} stop${stops.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const highlights = stops
    .slice(0, 3)
    .map((s) => s.name)
    .filter(Boolean)
    .join(" · ");
  return {
    title: who ? `${trip.title} — by ${who}` : trip.title,
    description: [parts.join(" · "), highlights].filter(Boolean).join(". "),
  };
};

/** Fetches the preview; undefined on any failure (the page still renders). */
export const fetchSharedTripMeta = async (
  baseUrl: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SharedTripMeta | undefined> => {
  try {
    const res = await fetchImpl(`${baseUrl}/loci.trip.TripService/GetSharedTrip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Connect-Protocol-Version": "1" },
      body: JSON.stringify({ shareCode: code }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    // GetSharedTrip answers with the TripDraft itself, not a wrapper.
    return sharedTripMeta((await res.json()) as WireTrip);
  } catch {
    return undefined;
  }
};
