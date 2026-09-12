import { createSignal, For, Show, createEffect, onMount } from "solid-js";
import { useParams } from "@solidjs/router";
import { AlertTriangle, Link as LinkIcon } from "lucide-solid";
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
import { useUserSubscription } from "~/lib/api/billing";
import { isProPlan } from "~/lib/subscription";
import { cacheTripOffline } from "~/lib/trip-offline-cache";
import {
  recordRecommendationEvents,
  type RecommendationEventName,
} from "~/lib/api/recommendations";
import PlacePicker from "~/components/trip/PlacePicker";
import TripHero from "~/components/trip/TripHero";
import TripPreferences from "~/components/trip/TripPreferences";
import TripDaySection from "~/components/trip/TripDaySection";
import TripStopRow from "~/components/trip/TripStopRow";
import TripLegRow from "~/components/trip/TripLegRow";
import TripDetailSkeleton from "~/components/trip/TripDetailSkeleton";
import TripMoney from "~/components/TripMoney";
import LocalWeather from "~/components/LocalWeather";
import TripGlobe from "~/components/features/Globe/TripGlobe";
import { Alert, AlertDescription, AlertTitle } from "~/ui/alert";
import { Button } from "~/ui/button";
import { colorForMapDay } from "~/lib/theme-colors";
import type { POI } from "~/lib/api/types";
import { copyShareLink } from "~/lib/api/share";
import { capture } from "~/lib/analytics";

/** Per-trip edit-mode memory, so a reload mid-edit does not drop you back into read mode. */
const editingKey = (tripId: string) => `loci.trip.editing.${tripId}`;

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
  const [copied, setCopied] = createSignal(false);

  /**
   * Read mode is the default: the page is read far more often than it is
   * edited, and the controls were drowning the itinerary. The choice is
   * remembered per trip so a reload mid-edit does not undo it.
   */
  const [editing, setEditing] = createSignal(false);
  onMount(() => {
    try {
      if (localStorage.getItem(editingKey(params.id!)) === "1") setEditing(true);
    } catch {
      /* private mode / storage disabled — read mode is a fine default */
    }
  });
  createEffect(() => {
    try {
      localStorage.setItem(editingKey(params.id!), editing() ? "1" : "0");
    } catch {
      /* nothing to do; the toggle still works for this session */
    }
  });

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
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
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
    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Show when={tripQuery.isLoading}>
        <TripDetailSkeleton />
      </Show>

      <Show when={tripQuery.isError}>
        <Alert variant="destructive" class="flex flex-wrap items-center gap-3">
          <AlertTriangle class="h-4 w-4" aria-hidden="true" />
          <AlertTitle class="mr-auto">Couldn't load this trip.</AlertTitle>
          <Button size="sm" variant="outline" onClick={() => void tripQuery.refetch()}>
            Retry
          </Button>
        </Alert>
      </Show>

      <Show when={trip()} keyed>
        {(t) => (
          <>
            <TripHero
              trip={t}
              tripId={params.id!}
              isPro={isPro()}
              editing={editing()}
              onEditingChange={setEditing}
              onShare={doShare}
              sharing={share.isPending}
            />

            <Show when={conflict()}>
              <Alert class="mb-4 border-accent/50">
                <AlertTriangle class="h-4 w-4" aria-hidden="true" />
                <AlertTitle>This trip changed on another device</AlertTitle>
                <AlertDescription>
                  Reloaded the latest version — re-apply your edit.
                </AlertDescription>
              </Alert>
            </Show>

            <Show when={shareUrl()}>
              <Alert class="mb-4 flex flex-wrap items-center gap-3">
                <LinkIcon class="h-4 w-4" aria-hidden="true" />
                <a
                  class="min-w-0 flex-1 truncate underline underline-offset-2"
                  href={shareUrl()!}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shareUrl()}
                </a>
                <Button size="sm" variant="ghost" onClick={() => void copySharedTrip()}>
                  {copied() ? "Copied" : "Copy"}
                </Button>
              </Alert>
            </Show>

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

            {/* This trip's own cities and legs. Only rendered when the trip
                actually carries coordinates — a single-city trip with no legs
                has no geometry worth a globe. */}
            <Show when={t.legs && t.legs.length > 0}>
              <section aria-labelledby="trip-globe-heading" class="mb-6">
                <h2
                  id="trip-globe-heading"
                  class="font-coord mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Route
                </h2>
                <div class="overflow-hidden rounded-2xl border border-border">
                  <TripGlobe trips={[t]} class="h-[320px]" />
                </div>
              </section>
            </Show>

            <TripPreferences constraints={t.constraints} onChange={updateConstraints} />

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
                    {(leg) => <TripLegRow leg={leg} />}
                  </For>

                  <TripDaySection
                    day={day}
                    tripCityName={t.cityName}
                    dotColor={colorForMapDay(day.dayNumber - 1)}
                    addSlot={
                      editing() ? (
                        <PlacePicker
                          cityName={t.cityName}
                          label={`Add another place to Day ${day.dayNumber}`}
                          busy={add.isPending}
                          onSelect={(poi) => addStop(day, poi)}
                        />
                      ) : undefined
                    }
                  >
                    <For each={day.stops}>
                      {(stop, i) => (
                        <TripStopRow
                          stop={stop}
                          index={i()}
                          isFirst={i() === 0}
                          isLast={i() === day.stops.length - 1}
                          editing={editing()}
                          dotColor={colorForMapDay(day.dayNumber - 1)}
                          replacing={replacingStopID() === stop.id}
                          removeConfirming={removeConfirmID() === stop.id}
                          onMove={(dir) => moveStop(day, i(), dir)}
                          onRename={(name) => renameStop(stop, name)}
                          onRetime={(start, duration) => retimeStop(stop, start, duration)}
                          onToggleReplace={() =>
                            setReplacingStopID((current) => (current === stop.id ? null : stop.id))
                          }
                          onRemove={() => removeStop(stop)}
                          onCancelRemove={() => setRemoveConfirmID(null)}
                          onOutcome={(eventType, rating) =>
                            recordStopOutcome(stop, eventType, rating)
                          }
                        >
                          <PlacePicker
                            cityName={t.cityName}
                            label={`Replace ${stop.name}`}
                            busy={replace.isPending}
                            onSelect={(poi) => replaceStop(stop, poi)}
                            onCancel={() => setReplacingStopID(null)}
                          />
                        </TripStopRow>
                      )}
                    </For>
                  </TripDaySection>
                </>
              )}
            </For>

            {/* The journey home, which has no day after it. */}
            <For each={(t.legs ?? []).filter((l) => l.afterDay >= t.days.length && l.afterDay > 0)}>
              {(leg) => <TripLegRow leg={leg} homeward />}
            </For>

            <TripChecklists tripId={params.id!} />
          </>
        )}
      </Show>
    </main>
  );
}
