import { createSignal, For, Show, createEffect, createMemo, onMount } from "solid-js";
import { A, useParams, useSearchParams } from "@solidjs/router";
import { AlertTriangle, Sparkles } from "lucide-solid";
import TripChecklists from "~/components/trip/TripChecklists";
import {
  useTrip,
  useReorderStops,
  useRenameStop,
  useEditStopDuration,
  useSetConstraint,
  useAddStop,
  useRemoveStop,
  useReplaceStop,
  type Trip,
  type TripDay,
  type TripStop,
  type TripConstraint,
  rememberTrip,
} from "~/lib/api/trips";
import { useQueryClient } from "@tanstack/solid-query";
import TripPlanPanel from "~/components/trip/TripPlanPanel";
import { useUserSubscription } from "~/lib/api/billing";
import { canUsePro } from "~/lib/subscription";
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
import HowWasIt from "~/components/ranking/HowWasIt";
import TripLegRow from "~/components/trip/TripLegRow";
import TripDetailSkeleton from "~/components/trip/TripDetailSkeleton";
import TripMoney from "~/components/TripMoney";
import LocalWeather from "~/components/LocalWeather";
import TripGlobe from "~/components/features/Globe/TripGlobe";
import { Alert, AlertDescription, AlertTitle } from "~/ui/alert";
import { Button } from "~/ui/button";
import { colorForMapDay } from "~/lib/theme-colors";
import type { POI } from "~/lib/api/types";
import TripSharePanel from "~/components/social/TripSharePanel";
import TripMembersBar from "~/components/trip/TripMembersBar";
import TripProposals from "~/components/trip/TripProposals";
import TripComments from "~/components/trip/TripComments";
import { flattenCommentPages, useTripComments } from "~/lib/api/trip-comments";
import {
  useProposeTripChange,
  useTripProposals,
  type SuggestedChange,
} from "~/lib/api/trip-proposals";
import { useAuth } from "~/contexts/AuthContext";
import { useMarkStop, type StopMark } from "~/lib/api/gamification";
import { showToast } from "~/lib/toast-store";
import { tripHasEnded } from "~/lib/recap/recap";

/** Per-trip edit-mode memory, so a reload mid-edit does not drop you back into read mode. */
const editingKey = (tripId: string) => `loci.trip.editing.${tripId}`;

export default function TripEditor() {
  const params = useParams();
  const tripQuery = useTrip(() => params.id!);
  const queryClient = useQueryClient();
  const subscriptionQuery = useUserSubscription();
  const { user } = useAuth();
  const isPro = () => canUsePro(subscriptionQuery.data?.plan);

  const reorder = useReorderStops();
  const rename = useRenameStop();
  const editDur = useEditStopDuration();
  const setConstraint = useSetConstraint();
  const add = useAddStop();
  const remove = useRemoveStop();
  const replace = useReplaceStop();
  const markStop = useMarkStop();
  const [markingStopID, setMarkingStopID] = createSignal<string | null>(null);

  const [sharing, setSharing] = createSignal(false);
  const [conflict, setConflict] = createSignal(false);
  const [replacingStopID, setReplacingStopID] = createSignal<string | null>(null);
  const [removeConfirmID, setRemoveConfirmID] = createSignal<string | null>(null);

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
  /**
   * The owner edits the trip. A co-planner's adds, swaps, moves and removals
   * become suggestions the owner applies; a viewer only reads.
   */
  const isOwner = () => !trip()?.owner;
  const canSuggest = () => trip()?.viewerRole === "co_planner";
  const [suggesting, setSuggesting] = createSignal(false);
  const changes = () => (isOwner() ? "direct" : canSuggest() ? "suggest" : "none");
  const stopControls = () => (isOwner() ? editing() : canSuggest() && suggesting());
  const version = () => trip()?.version ?? 0n;

  const propose = useProposeTripChange();
  /** Only a trip planned together has suggestions to show. */
  const proposalsQuery = useTripProposals(
    () => params.id,
    () => !!trip() && (!isOwner() || (trip()?.members?.length ?? 0) > 0),
  );
  const proposals = () => proposalsQuery.data ?? [];
  /** A trip planned together has comments; one nobody else is on does not. */
  const shared = () => !!trip() && (!isOwner() || (trip()?.members?.length ?? 0) > 0);
  const commentsQuery = useTripComments(() => params.id, shared);
  // Guarded read: touching .data while pending suspends the whole route. Not
  // isSuccess: a failed "Load older" turns the status to error but keeps the
  // pages already loaded, and those should stay on screen.
  const comments = createMemo(() =>
    flattenCommentPages(
      commentsQuery.isPending || commentsQuery.isLoadingError ? undefined : commentsQuery.data,
    ),
  );

  /**
   * A trip brief that saw a closed stop links here with ?swap=<stop>: open the
   * swap picker on it, as a direct edit for the owner and a suggestion for a
   * co-planner. A viewer just sees the trip. Once per visit.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  createEffect(() => {
    const swap = typeof searchParams.swap === "string" ? searchParams.swap : undefined;
    const t = trip();
    if (!swap || !t) return;
    setSearchParams({ swap: undefined }, { replace: true });
    if (changes() === "none" || !t.days.some((d) => d.stops.some((s) => s.id === swap))) return;
    if (isOwner()) setEditing(true);
    else setSuggesting(true);
    setReplacingStopID(swap);
  });
  const suggest = (change: SuggestedChange, onDone?: () => void) =>
    propose.mutate(
      { tripId: params.id!, baseVersion: version(), change },
      {
        onSuccess: (p) => {
          onDone?.();
          showToast({ id: `suggested-${p.id}`, title: "Suggestion sent to the planner" });
        },
        onError: () =>
          showToast({ id: `suggest-failed-${params.id}`, title: "Couldn't send that suggestion" }),
      },
    );

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

  /**
   * Walked or skipped. Shown at once (the server only adds points), put back
   * from the server if the call fails. A finished day or trip is the one
   * moment worth a toast.
   */
  const setStopMark = (day: TripDay, stop: TripStop, mark: StopMark) => {
    const t = trip();
    if (!t) return;
    const key = ["trips", "detail", t.id];
    queryClient.setQueryData(key, (old: Trip | undefined) =>
      old
        ? {
            ...old,
            days: old.days.map((d) =>
              d.id !== day.id
                ? d
                : { ...d, stops: d.stops.map((s) => (s.id === stop.id ? { ...s, mark } : s)) },
            ),
          }
        : old,
    );
    setMarkingStopID(stop.id);
    markStop.mutate(
      { tripId: t.id, dayId: day.id, stopId: stop.id, mark },
      {
        onSuccess: (res) => {
          if (res.tripFinished) {
            showToast({
              id: `field-trip-${t.id}`,
              title: `Trip finished · +${res.points} field score`,
              action: { label: "Field", href: "/field" },
            });
          } else if (res.dayFinished) {
            showToast({
              id: `field-day-${day.id}`,
              title: `Day ${day.dayNumber} finished · +${res.points} field score`,
              action: { label: "Field", href: "/field" },
            });
          }
        },
        onError: () => void queryClient.invalidateQueries({ queryKey: key }),
        onSettled: () => setMarkingStopID(null),
      },
    );
  };

  const moveStop = (day: TripDay, index: number, dir: -1 | 1) => {
    const ids = day.stops.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    if (!isOwner()) {
      suggest({ kind: "moveStop", stopId: ids[index], toDayId: day.id, toIndex: j });
      return;
    }
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

  const addStop = (day: TripDay, poi: POI) => {
    const stop: TripStop = {
      id: crypto.randomUUID(),
      poiId: poi.id,
      orderIndex: day.stops.length,
      name: poi.name,
      notes: poi.description_poi || poi.description || "Added from place search",
    };
    if (!isOwner()) {
      suggest({ kind: "addStop", dayId: day.id, stop });
      return;
    }
    add.mutate(
      { tripId: params.id!, dayId: day.id, baseVersion: version(), stop },
      { onError: onMutationError },
    );
  };

  const removeStop = (stop: TripStop) => {
    if (removeConfirmID() !== stop.id) {
      setRemoveConfirmID(stop.id);
      return;
    }
    if (!isOwner()) {
      suggest({ kind: "removeStop", stopId: stop.id }, () => setRemoveConfirmID(null));
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
    const replacement: TripStop = {
      ...stop,
      id: crypto.randomUUID(),
      poiId: poi.id,
      name: poi.name,
      notes: poi.description_poi || poi.description || "Replaced from place search",
      recommendationTrace: undefined,
    };
    if (!isOwner()) {
      suggest({ kind: "replaceStop", stopId: stop.id, replacement }, () =>
        setReplacingStopID(null),
      );
      return;
    }
    replace.mutate(
      { tripId: params.id!, currentStop: stop, baseVersion: version(), replacement },
      {
        onSuccess: () => setReplacingStopID(null),
        onError: onMutationError,
      },
    );
  };

  // The stop the traveller just marked visited, asked "How was it?" in place.
  const [ratingStopID, setRatingStopID] = createSignal<string | null>(null);

  const recordStopOutcome = (
    stop: TripStop,
    eventType: RecommendationEventName,
    rating?: number,
  ) => {
    if (!stop.recommendationTrace) return;
    if (eventType === "RECOMMENDATION_EVENT_TYPE_VISIT_CONFIRMED" && stop.poiId) {
      setRatingStopID(stop.id);
    }
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
              editing={editing() && isOwner()}
              onEditingChange={setEditing}
              onShare={() => setSharing(true)}
              sharing={false}
            />

            <Show when={tripHasEnded(t)}>
              <A
                href={`/recap/trip/${params.id}`}
                class="loci-card mb-4 flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
              >
                <Sparkles class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block font-medium">Your trip recap</span>
                  <span class="block text-sm text-muted-foreground">
                    The places, the kilometres and what Loci learned about your taste.
                  </span>
                </span>
                <span class="text-sm font-medium text-primary">See it</span>
              </A>
            </Show>

            <TripMembersBar
              trip={t}
              currentUserId={user()?.id}
              suggesting={canSuggest() ? suggesting() : undefined}
              onToggleSuggest={() => setSuggesting((on) => !on)}
            />

            <Show when={proposals().length > 0}>
              <TripProposals
                tripId={t.id}
                proposals={proposals()}
                isOwner={isOwner()}
                currentUserId={user()?.id}
                baseVersion={tripQuery.isFetching ? undefined : t.version}
                onConflict={() => tripQuery.refetch()}
              />
            </Show>

            <Show when={shared()}>
              <TripComments
                tripId={t.id}
                comments={comments().comments}
                hasMore={comments().hasMore}
                loadingOlder={commentsQuery.isFetchingNextPage}
                olderFailed={commentsQuery.isFetchNextPageError}
                onLoadOlder={() => void commentsQuery.fetchNextPage()}
                stops={t.days.flatMap((d) => d.stops.map((s) => ({ id: s.id, name: s.name })))}
              />
            </Show>

            <TripSharePanel
              open={sharing()}
              onOpenChange={setSharing}
              tripId={params.id!}
              visibility={t.visibility}
              shareCode={t.shareCode}
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

            {/* The plan (dates, stays, flights) is the owner's to edit; a friend
                reading a shared trip sees it in the day list and header. */}
            <Show when={!t.owner}>
              <TripPlanPanel
                trip={t}
                onUpdated={(updated) => rememberTrip(queryClient, updated)}
                onConflict={() => {
                  setConflict(true);
                  tripQuery.refetch();
                }}
              />
            </Show>

            <Show when={isOwner()}>
              <TripPreferences constraints={t.constraints} onChange={updateConstraints} />
            </Show>

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
                      stopControls() ? (
                        <PlacePicker
                          cityName={t.cityName}
                          label={
                            isOwner()
                              ? `Add another place to Day ${day.dayNumber}`
                              : `Suggest a place for Day ${day.dayNumber}`
                          }
                          busy={add.isPending || propose.isPending}
                          onSelect={(poi) => addStop(day, poi)}
                        />
                      ) : undefined
                    }
                  >
                    <For each={day.stops}>
                      {(stop, i) => (
                        <>
                          <TripStopRow
                            stop={stop}
                            index={i()}
                            isFirst={i() === 0}
                            isLast={i() === day.stops.length - 1}
                            editing={stopControls()}
                            changes={changes()}
                            dotColor={colorForMapDay(day.dayNumber - 1)}
                            replacing={replacingStopID() === stop.id}
                            removeConfirming={removeConfirmID() === stop.id}
                            onMove={(dir) => moveStop(day, i(), dir)}
                            onRename={(name) => renameStop(stop, name)}
                            onRetime={(start, duration) => retimeStop(stop, start, duration)}
                            onToggleReplace={() =>
                              setReplacingStopID((current) =>
                                current === stop.id ? null : stop.id,
                              )
                            }
                            onRemove={() => removeStop(stop)}
                            onCancelRemove={() => setRemoveConfirmID(null)}
                            onOutcome={(eventType, rating) =>
                              recordStopOutcome(stop, eventType, rating)
                            }
                            onMark={isOwner() ? (mark) => setStopMark(day, stop, mark) : undefined}
                            marking={markingStopID() === stop.id}
                          >
                            <PlacePicker
                              cityName={t.cityName}
                              label={`Replace ${stop.name}`}
                              busy={replace.isPending || propose.isPending}
                              onSelect={(poi) => replaceStop(stop, poi)}
                              onCancel={() => setReplacingStopID(null)}
                            />
                          </TripStopRow>
                          <Show when={ratingStopID() === stop.id}>
                            <div class="my-2 ml-8">
                              <HowWasIt
                                poiId={stop.poiId}
                                name={stop.name}
                                cityName={t.cityName}
                                onDone={() => setRatingStopID(null)}
                              />
                            </div>
                          </Show>
                        </>
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

            {/* Packing and expenses are the owner's own lists. */}
            <Show when={isOwner()}>
              <TripChecklists tripId={params.id!} />
            </Show>
          </>
        )}
      </Show>
    </main>
  );
}
