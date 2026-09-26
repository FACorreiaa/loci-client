import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { MapPin } from "lucide-solid";
import UserAvatar from "~/components/social/UserAvatar";
import type { Trip } from "~/lib/api/trips";
import { formatTripDates } from "~/lib/trip-format";
import { sharedTripPath, visibilityLabel } from "~/lib/social/visibility";

export const friendTripPath = (id: string) => `/friends/trips/${encodeURIComponent(id)}`;

/**
 * Public trips come with their link, which opens signed out too; the rest
 * open by id, which needs a session.
 */
export const tripHref = (t: Pick<Trip, "id" | "shareCode">) =>
  t.shareCode ? sharedTripPath(t.shareCode) : friendTripPath(t.id);

/** A trip someone shared with you, as a card in the feed or on a profile. */
export default function FriendTripCard(props: { trip: Trip; showOwner?: boolean }) {
  const stops = () => props.trip.days.reduce((n, d) => n + d.stops.length, 0);
  const days = () => props.trip.days.length;
  return (
    <A
      href={tripHref(props.trip)}
      class="loci-card group block p-4 transition-colors hover:border-primary/50"
    >
      <Show when={props.showOwner && props.trip.owner}>
        {(o) => (
          <p class="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar user={o()} size="sm" />
            <span class="truncate">
              <span class="font-medium text-foreground">{o().displayName}</span> shared a trip
            </span>
          </p>
        )}
      </Show>
      <h3 class="text-lg font-medium group-hover:underline">{props.trip.title}</h3>
      <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Show when={props.trip.cityName}>
          <span class="inline-flex items-center gap-1">
            <MapPin class="h-3.5 w-3.5" aria-hidden="true" />
            {props.trip.cityName}
          </span>
        </Show>
        <span>
          {days()} day{days() === 1 ? "" : "s"} · {stops()} stop{stops() === 1 ? "" : "s"}
        </span>
        <Show when={formatTripDates(props.trip.days)}>{(d) => <span>{d()}</span>}</Show>
      </p>
      <p class="font-coord mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {visibilityLabel(props.trip.visibility)}
      </p>
    </A>
  );
}
