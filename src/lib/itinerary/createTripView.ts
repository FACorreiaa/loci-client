/* ============================================================
   The trip behind an itinerary page, and the edits made to it.

   The page opens by chat session; the trip is found from that
   (or from a trip id it was handed), held here, and every edit
   goes to TripService with the version this copy was read at.
   The trip that comes back replaces this copy and the one
   /trips/:id reads, so the two screens never disagree.

   Held in signals and loaded imperatively on purpose: reading a
   solid-query `.data` on this route suspends to the app-wide
   Suspense and blanks the whole page.
   ============================================================ */

import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import {
  fetchTrip,
  fetchTripForSession,
  isTripConflict,
  tripEdits,
  tripKeys,
  type Trip,
  type TripStop,
} from "@/lib/api/trips";
import { showToast } from "@/lib/toast-store";
import { findTripStop, orderAfterNudge } from "./trip-view";

/** "stale" is a copy kept on this device, shown because the trip could not be read. */
export type TripViewStatus = "idle" | "loading" | "ready" | "stale" | "none" | "error";

export interface TripViewOptions {
  /** A trip id the page already knows (from the URL or the finished run). */
  tripId: () => string | undefined;
  /** The chat session the itinerary was generated in. */
  sessionId: () => string | undefined;
  /** False while there is nobody signed in, or nothing to look up yet. */
  enabled: () => boolean;
  /** Called with every trip this view takes on: loaded, edited or refreshed. */
  onTrip?: (trip: Trip) => void;
  /**
   * The copy of the trip kept on this device, asked for only when the trip
   * cannot be read. It is shown as it was and cannot be edited.
   */
  deviceCopy?: () => Promise<Trip | undefined>;
}

export function createTripView(opts: TripViewOptions) {
  const qc = useQueryClient();
  const [trip, setTrip] = createSignal<Trip | undefined>();
  const [status, setStatus] = createSignal<TripViewStatus>("idle");
  const [busy, setBusy] = createSignal(false);
  // A load that finishes after a newer one started must not win.
  let loadSeq = 0;

  const adopt = (next: Trip) => {
    const prev = trip();
    // Edit responses carry the trip but not who is looking at it; that does
    // not change with an edit, so it is kept from the trip as it was read.
    const merged: Trip =
      prev && prev.id === next.id
        ? {
            ...next,
            viewerRole: next.viewerRole ?? prev.viewerRole,
            owner: next.owner ?? prev.owner,
            members: next.members ?? prev.members,
          }
        : next;
    setTrip(merged);
    setStatus("ready");
    qc.setQueryData(tripKeys.detail(merged.id), merged);
    opts.onTrip?.(merged);
  };

  const load = async () => {
    if (!opts.enabled()) {
      setStatus("idle");
      return;
    }
    const tripId = opts.tripId();
    const sessionId = opts.sessionId();
    if (!tripId && !sessionId) return;
    const seq = ++loadSeq;
    if (!trip() || status() === "stale") setStatus(trip() ? "stale" : "loading");
    try {
      const found = tripId ? await fetchTrip(tripId) : await fetchTripForSession(sessionId!);
      if (seq !== loadSeq) return;
      if (found) adopt(found);
      else if (!trip()) setStatus("none");
    } catch {
      if (seq !== loadSeq) return;
      // A trip already on screen stays; a failed refresh is not a reason to
      // take the traveller's plan away.
      if (trip()) return;
      const kept = await opts.deviceCopy?.().catch(() => undefined);
      if (seq !== loadSeq) return;
      if (kept) {
        setTrip(kept);
        setStatus("stale");
      } else {
        setStatus("error");
      }
    }
  };

  createEffect(on([opts.enabled, opts.tripId, opts.sessionId], () => void load()));

  // Someone else may have changed the trip while this tab was in the
  // background: a co-planner, the trip editor in another tab, Telegram.
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && trip() && !busy()) void load();
    };
    // Back on the network: swap the device copy for the real trip.
    const onOnline = () => {
      if (status() === "stale" || status() === "error") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    });
  });

  /**
   * Runs one edit against the trip as it stands. Returns whether it stuck.
   * A conflict means the trip changed elsewhere: the latest is fetched and
   * shown, and the traveller is told, rather than their edit silently
   * overwriting someone else's.
   */
  const run = async (edit: (current: Trip) => Promise<Trip> | null): Promise<boolean> => {
    const current = trip();
    if (!current || busy()) return false;
    const pending = edit(current);
    if (!pending) return false;
    setBusy(true);
    try {
      adopt(await pending);
      return true;
    } catch (err) {
      if (isTripConflict(err)) {
        await load();
        showToast({
          id: `trip-conflict-${current.id}`,
          title: "This trip changed somewhere else. Showing the latest.",
        });
      } else {
        showToast({
          id: `trip-edit-failed-${current.id}`,
          title: "Couldn't save that change. Try again.",
        });
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    trip,
    status,
    busy,
    /** Only the owner edits here; a co-planner suggests from the trip page. */
    canEdit: () => {
      const t = trip();
      return !!t && status() === "ready" && (t.viewerRole ?? "owner") === "owner";
    },
    refetch: load,
    adopt,
    /** One place up or down within its day. */
    nudge: (tripStopId: string, direction: "up" | "down") =>
      run((t) => {
        const order = orderAfterNudge(t, tripStopId, direction);
        return order ? tripEdits.reorder({ tripId: t.id, baseVersion: t.version, ...order }) : null;
      }),
    /** To the end of another day. */
    moveToDay: (tripStopId: string, toDayId: string) =>
      run((t) => {
        const found = findTripStop(t, tripStopId);
        const to = t.days.find((d) => d.id === toDayId);
        if (!found || !to || found.day.id === toDayId) return null;
        return tripEdits.move({
          tripId: t.id,
          stopId: tripStopId,
          toDayId,
          toIndex: to.stops.length,
          baseVersion: t.version,
        });
      }),
    remove: (tripStopId: string) =>
      run((t) =>
        findTripStop(t, tripStopId)
          ? tripEdits.remove({ tripId: t.id, stopId: tripStopId, baseVersion: t.version })
          : null,
      ),
    /** After `afterStopId` when given, otherwise at the end of the day. */
    add: (dayId: string, stop: NewStop, afterStopId?: string) =>
      run((t) =>
        t.days.some((d) => d.id === dayId)
          ? tripEdits.add({
              tripId: t.id,
              dayId,
              stop: { id: "", orderIndex: 0, notes: "", poiId: "", ...stop },
              baseVersion: t.version,
              afterStopId,
            })
          : null,
      ),
  };
}

/** What a caller says about a stop it wants added; the rest is the server's. */
export type NewStop = Pick<TripStop, "name"> &
  Partial<Pick<TripStop, "poiId" | "notes" | "latitude" | "longitude" | "address">>;

export type TripViewHandle = ReturnType<typeof createTripView>;
