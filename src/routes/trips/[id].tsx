import { createSignal, For, Show, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import { Car } from "lucide-solid";
import TripChecklists from "~/components/trip/TripChecklists";
import {
  useTrip,
  useReorderStops,
  useRenameStop,
  useEditStopDuration,
  useSetConstraint,
  useShareTrip,
  useAddStop,
  useRemoveStop,
  useReplaceStop,
  type Trip,
  type TripDay,
  type TripStop,
  type TripConstraint,
} from "~/lib/api/trips";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { useUserSubscription } from "~/lib/api/billing";
import { isProPlan } from "~/lib/subscription";
import TripExportMenu from "~/components/trip/TripExportMenu";
import WhyThisStop from "~/components/poi/WhyThisStop";
import { cacheTripOffline } from "~/lib/trip-offline-cache";
import {
  recordRecommendationEvents,
  type RecommendationEventName,
} from "~/lib/api/recommendations";
import PlacePicker from "~/components/trip/PlacePicker";
import TripMoney from "@/components/TripMoney";
import LocalWeather from "@/components/LocalWeather";
import TripGlobe from "~/components/features/Globe/TripGlobe";
import type { POI } from "~/lib/api/types";
import { copyShareLink } from "~/lib/api/share";
import { capture } from "~/lib/analytics";

const minutesToHHMM = (m?: number) => {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const hhmmToMinutes = (v: string): number | undefined => {
  if (!v) return undefined;
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  return h * 60 + m;
};

const PACE_LABELS: Record<number, string> = {
  [TripPace.UNSPECIFIED]: "—",
  [TripPace.RELAXED]: "Relaxed",
  [TripPace.MODERATE]: "Moderate",
  [TripPace.PACKED]: "Packed",
};

export default function TripEditor() {
  const params = useParams();
  const tripQuery = useTrip(() => params.id!);
  const subscriptionQuery = useUserSubscription();
  const isPro = () => isProPlan(subscriptionQuery.data?.plan);

  const reorder = useReorderStops();
  const rename = useRenameStop();
  const editDur = useEditStopDuration();
  const setConstraint = useSetConstraint();
  const share = useShareTrip();
  const add = useAddStop();
  const remove = useRemoveStop();
  const replace = useReplaceStop();

  const [shareUrl, setShareUrl] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal(false);
  const [replacingStopID, setReplacingStopID] = createSignal<string | null>(null);
  const [removeConfirmID, setRemoveConfirmID] = createSignal<string | null>(null);

  const trip = () => tripQuery.data as Trip | undefined;
  const version = () => trip()?.version ?? 0n;

  /**
   * The trip's primary city, for weather and currency.
   *
   * Taken from the first day that carries coordinates rather than from the
   * trip's city *name*: a multi-city trip's days each know where they are, and
   * a name would have to be geocoded to be useful.
   */
  const primaryCityCoords = () => {
    const day = trip()?.days?.find((d) => d.cityLat != null && d.cityLon != null);
    return day ? { lat: day.cityLat!, lon: day.cityLon! } : undefined;
  };

  /** Total driving distance across the trip's legs. Zero hides the fuel line. */
  const totalDriveKm = () => (trip()?.legs ?? []).reduce((sum, l) => sum + (l.distanceKm ?? 0), 0);

  createEffect(() => {
    const t = trip();
    if (t?.id) cacheTripOffline(t);
  });

  const onMutationError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("version") || msg.toLowerCase().includes("precondition")) {
      setConflict(true);
      tripQuery.refetch();
    }
  };

  const moveStop = (day: TripDay, index: number, dir: -1 | 1) => {
    const ids = day.stops.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(
      { tripId: params.id!, dayId: day.id, orderedStopIds: ids, baseVersion: version() },
      { onError: onMutationError },
    );
  };

  const renameStop = (stop: TripStop, name: string) => {
    if (name === stop.name || !name.trim()) return;
    rename.mutate(
      { tripId: params.id!, stopId: stop.id, name, baseVersion: version() },
      { onError: onMutationError },
    );
  };

  const retimeStop = (stop: TripStop, startMinute?: number, durationMinutes?: number) => {
    editDur.mutate(
      {
        tripId: params.id!,
        stopId: stop.id,
        startMinute,
        durationMinutes: durationMinutes ?? stop.durationMinutes ?? 0,
        baseVersion: version(),
      },
      { onError: onMutationError },
    );
  };

  const updateConstraints = (patch: Partial<TripConstraint>) => {
    const t = trip();
    if (!t) return;
    setConstraint.mutate(
      { tripId: params.id!, constraints: { ...t.constraints, ...patch }, baseVersion: version() },
      { onError: onMutationError },
    );
  };

  const doShare = () =>
    share.mutate(
      { tripId: params.id!, isPublic: true },
      {
        onSuccess: (r) => {
          setShareUrl(r.shareUrl);
          capture("share_link_created", { content_type: "trip" });
        },
      },
    );

  const copySharedTrip = async () => {
    const url = shareUrl();
    if (url && (await copyShareLink(url))) {
      capture("share_link_copied", { content_type: "trip" });
    }
  };

  const addStop = (day: TripDay, poi: POI) => {
    add.mutate(
      {
        tripId: params.id!,
        dayId: day.id,
        baseVersion: version(),
        stop: {
          id: crypto.randomUUID(),
          poiId: poi.id,
          orderIndex: day.stops.length,
          name: poi.name,
          notes: poi.description_poi || poi.description || "Added from place search",
        },
      },
      {
        onError: onMutationError,
      },
    );
  };

  const removeStop = (stop: TripStop) => {
    if (removeConfirmID() !== stop.id) {
      setRemoveConfirmID(stop.id);
      return;
    }
    remove.mutate(
      { tripId: params.id!, stop, baseVersion: version() },
      {
        onSuccess: () => setRemoveConfirmID(null),
        onError: onMutationError,
      },
    );
  };

  const replaceStop = (stop: TripStop, poi: POI) => {
    replace.mutate(
      {
        tripId: params.id!,
        currentStop: stop,
        baseVersion: version(),
        replacement: {
          ...stop,
          id: crypto.randomUUID(),
          poiId: poi.id,
          name: poi.name,
          notes: poi.description_poi || poi.description || "Replaced from place search",
          recommendationTrace: undefined,
        },
      },
      {
        onSuccess: () => setReplacingStopID(null),
        onError: onMutationError,
      },
    );
  };

  const recordStopOutcome = (
    stop: TripStop,
    eventType: RecommendationEventName,
    rating?: number,
  ) => {
    if (!stop.recommendationTrace) return;
    void recordRecommendationEvents([
      {
        eventType,
        trace: stop.recommendationTrace,
        poiId: stop.poiId,
        tripId: params.id!,
        rating,
      },
    ]);
  };

  return (
    <main class="mx-auto max-w-3xl px-4 py-8">
      <Show when={tripQuery.isLoading}>
        <p class="text-muted-foreground">Loading trip…</p>
      </Show>
      <Show when={tripQuery.isError}>
        <p class="text-destructive">Couldn't load this trip.</p>
      </Show>

      <Show when={trip()} keyed>
        {(t) => (
          <>
            <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 class="text-2xl font-semibold">{t.title}</h1>
                <p class="text-sm text-muted-foreground">
                  {t.cityName} · {t.days.length} day{t.days.length === 1 ? "" : "s"} · v
                  {t.version.toString()}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <TripExportMenu
                  tripId={params.id!}
                  dayCount={t.days.length}
                  isPro={isPro()}
                  trip={t}
                />
                <button
                  class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                  onClick={doShare}
                >
                  Share
                </button>
              </div>
            </header>

            <Show when={conflict()}>
              <div class="mb-4 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This trip changed on another device — reloaded the latest version. Re-apply your
                edit.
              </div>
            </Show>

            <Show when={shareUrl()}>
              <div class="mb-4 rounded-md border bg-muted px-3 py-2 text-sm">
                Share link:{" "}
                <a class="underline" href={shareUrl()!} target="_blank" rel="noreferrer">
                  {shareUrl()}
                </a>{" "}
                <button class="underline" onClick={() => void copySharedTrip()}>
                  Copy
                </button>
              </div>
            </Show>

            {/* This trip's own cities and legs. Only rendered when the trip
                actually carries coordinates — a single-city trip with no legs
                has no geometry worth a globe. */}
            {/* Trip-time context for the primary city, and what the driving
                costs. driveKm is the sum of the legs the trip actually
                carries — the fuel estimate is meaningless without it, and this
                is the only page that knows the real distances. */}
            <Show when={primaryCityCoords()}>
              {(c) => (
                <section aria-label="Trip context" class="mb-6 space-y-3">
                  <LocalWeather latitude={c().lat} longitude={c().lon} />
                  <TripMoney latitude={c().lat} longitude={c().lon} driveKm={totalDriveKm()} />
                </section>
              )}
            </Show>

            <Show when={t.legs && t.legs.length > 0}>
              <section aria-labelledby="trip-globe-heading" class="mb-6">
                <h2
                  id="trip-globe-heading"
                  class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Route
                </h2>
                <TripGlobe trips={[t]} class="h-[320px]" />
              </section>
            </Show>

            <section class="loci-card mb-6 rounded-xl p-4">
              <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Trip preferences
              </h2>
              <div class="flex flex-wrap gap-4">
                <label class="flex flex-col text-sm">
                  Pace
                  <select
                    class="mt-1 rounded-md border px-2 py-1"
                    value={t.constraints.pace}
                    onChange={(e) => updateConstraints({ pace: Number(e.currentTarget.value) })}
                  >
                    <For each={Object.entries(PACE_LABELS)}>
                      {([val, label]) => <option value={val}>{label}</option>}
                    </For>
                  </select>
                </label>
                <label class="flex flex-col text-sm">
                  Budget (1–4)
                  <input
                    type="number"
                    min="1"
                    max="4"
                    class="mt-1 w-24 rounded-md border px-2 py-1"
                    value={t.constraints.budgetLevel ?? ""}
                    onChange={(e) =>
                      updateConstraints({
                        budgetLevel: e.currentTarget.value
                          ? Number(e.currentTarget.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label class="flex flex-col text-sm">
                  Mobility
                  <input
                    type="text"
                    class="mt-1 w-40 rounded-md border px-2 py-1"
                    value={t.constraints.mobility ?? ""}
                    placeholder="walking, transit…"
                    onChange={(e) => updateConstraints({ mobility: e.currentTarget.value })}
                  />
                </label>
                <label class="flex flex-col text-sm">
                  Day starts
                  <input
                    type="time"
                    class="mt-1 rounded-md border px-2 py-1"
                    value={minutesToHHMM(t.constraints.dayStartMinute)}
                    onChange={(e) =>
                      updateConstraints({ dayStartMinute: hhmmToMinutes(e.currentTarget.value) })
                    }
                  />
                </label>
                <label class="flex flex-col text-sm">
                  Day ends
                  <input
                    type="time"
                    class="mt-1 rounded-md border px-2 py-1"
                    value={minutesToHHMM(t.constraints.dayEndMinute)}
                    onChange={(e) =>
                      updateConstraints({ dayEndMinute: hhmmToMinutes(e.currentTarget.value) })
                    }
                  />
                </label>
              </div>
            </section>

            <For each={t.days}>
              {(day) => (
                <>
                  {/* On a multi-city trip, the drive to the next city belongs
                      between the days, which is where it actually happens. */}
                  <For
                    each={(t.legs ?? []).filter(
                      (l) => l.afterDay === day.dayNumber - 1 && l.afterDay > 0,
                    )}
                  >
                    {(leg) => (
                      <div class="mb-6 flex items-center gap-2 px-1 text-sm text-muted-foreground">
                        <Car class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>
                          {leg.fromName} → {leg.toName} · {Math.round(leg.distanceKm)} km ·{" "}
                          {Math.floor(leg.durationMins / 60)}h
                          {String(leg.durationMins % 60).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </For>

                  <section class="loci-card mb-6 rounded-xl p-4">
                    <h2 class="mb-2 text-lg font-medium">
                      Day {day.dayNumber}
                      {/* The day's city, when the trip spans more than one. */}
                      <Show when={day.cityName && day.cityName !== t.cityName}>
                        <span class="ml-2 text-sm font-normal text-accent">{day.cityName}</span>
                      </Show>
                      <Show when={day.date}>
                        <span class="ml-2 text-sm text-muted-foreground">
                          {new Date(day.date!).toLocaleDateString()}
                        </span>
                      </Show>
                      <Show when={day.travelDay}>
                        <span class="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          travel day
                        </span>
                      </Show>
                    </h2>
                    <ol class="space-y-2">
                      <For each={day.stops}>
                        {(stop, i) => (
                          <li class="rounded-md border p-3">
                            <div class="flex items-center gap-2">
                              <div class="flex flex-col">
                                <button
                                  class="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={i() === 0}
                                  onClick={() => moveStop(day, i(), -1)}
                                  aria-label="Move up"
                                >
                                  ▲
                                </button>
                                <button
                                  class="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={i() === day.stops.length - 1}
                                  onClick={() => moveStop(day, i(), 1)}
                                  aria-label="Move down"
                                >
                                  ▼
                                </button>
                              </div>
                              <input
                                class="flex-1 rounded-md border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-input focus:border-input"
                                value={stop.name}
                                onChange={(e) => renameStop(stop, e.currentTarget.value)}
                              />
                              <input
                                type="time"
                                class="rounded-md border px-2 py-1 text-sm"
                                value={minutesToHHMM(stop.startMinute)}
                                onChange={(e) =>
                                  retimeStop(
                                    stop,
                                    hhmmToMinutes(e.currentTarget.value),
                                    stop.durationMinutes,
                                  )
                                }
                              />
                              <input
                                type="number"
                                min="0"
                                step="15"
                                class="w-20 rounded-md border px-2 py-1 text-sm"
                                title="Duration (minutes)"
                                value={stop.durationMinutes ?? ""}
                                onChange={(e) =>
                                  retimeStop(
                                    stop,
                                    stop.startMinute,
                                    e.currentTarget.value ? Number(e.currentTarget.value) : 0,
                                  )
                                }
                              />
                              <span class="text-xs text-muted-foreground">min</span>
                              <button
                                type="button"
                                class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                onClick={() =>
                                  setReplacingStopID((current) =>
                                    current === stop.id ? null : stop.id,
                                  )
                                }
                                aria-expanded={replacingStopID() === stop.id}
                              >
                                {replacingStopID() === stop.id ? "Close search" : "Replace"}
                              </button>
                              <button
                                type="button"
                                class={`rounded-md border px-2 py-1 text-xs transition-colors ${
                                  removeConfirmID() === stop.id
                                    ? "border-destructive bg-destructive text-destructive-foreground"
                                    : "border-destructive/40 text-destructive hover:bg-destructive/10"
                                }`}
                                onClick={() => removeStop(stop)}
                              >
                                {removeConfirmID() === stop.id ? "Confirm remove" : "Remove"}
                              </button>
                            </div>
                            <Show when={replacingStopID() === stop.id}>
                              <div class="mt-3 pl-8">
                                <PlacePicker
                                  cityName={t.cityName}
                                  label={`Replace ${stop.name}`}
                                  busy={replace.isPending}
                                  onSelect={(poi) => replaceStop(stop, poi)}
                                  onCancel={() => setReplacingStopID(null)}
                                />
                              </div>
                            </Show>
                            <div class="mt-2 flex flex-wrap items-center gap-2 pl-8">
                              <WhyThisStop reason={stop.notes} />
                              <Show when={stop.recommendationTrace}>
                                <button
                                  type="button"
                                  class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                  onClick={() =>
                                    recordStopOutcome(
                                      stop,
                                      "RECOMMENDATION_EVENT_TYPE_KEPT_IN_TRIP",
                                    )
                                  }
                                >
                                  Keep this stop
                                </button>
                                <button
                                  type="button"
                                  class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                  onClick={() =>
                                    recordStopOutcome(
                                      stop,
                                      "RECOMMENDATION_EVENT_TYPE_VISIT_CONFIRMED",
                                    )
                                  }
                                >
                                  Mark visited
                                </button>
                                <select
                                  class="rounded-md border px-2 py-1 text-xs"
                                  aria-label={`Rate ${stop.name}`}
                                  value=""
                                  onChange={(event) => {
                                    const rating = Number(event.currentTarget.value);
                                    if (rating > 0) {
                                      recordStopOutcome(
                                        stop,
                                        "RECOMMENDATION_EVENT_TYPE_RATED",
                                        rating,
                                      );
                                      event.currentTarget.value = "";
                                    }
                                  }}
                                >
                                  <option value="">Rate…</option>
                                  <For each={[1, 2, 3, 4, 5]}>
                                    {(rating) => <option value={rating}>{rating} / 5</option>}
                                  </For>
                                </select>
                              </Show>
                              <Show when={stop.bookingUrl}>
                                <a
                                  href={stop.bookingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  class="rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
                                  onClick={() =>
                                    recordStopOutcome(
                                      stop,
                                      "RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED",
                                    )
                                  }
                                >
                                  Open booking
                                </a>
                              </Show>
                            </div>
                          </li>
                        )}
                      </For>
                    </ol>
                    <div class="mt-3">
                      <PlacePicker
                        cityName={t.cityName}
                        label={`Add another place to Day ${day.dayNumber}`}
                        busy={add.isPending}
                        onSelect={(poi) => addStop(day, poi)}
                      />
                    </div>
                  </section>
                </>
              )}
            </For>

            {/* The journey home, which has no day after it. */}
            <For each={(t.legs ?? []).filter((l) => l.afterDay >= t.days.length && l.afterDay > 0)}>
              {(leg) => (
                <div class="mb-6 flex items-center gap-2 px-1 text-sm text-muted-foreground">
                  <Car class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {leg.fromName} → {leg.toName} · {Math.round(leg.distanceKm)} km · heading home
                  </span>
                </div>
              )}
            </For>

            <TripChecklists tripId={params.id!} />
          </>
        )}
      </Show>
    </main>
  );
}
