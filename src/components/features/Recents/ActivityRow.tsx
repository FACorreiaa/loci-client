import { Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  MessageSquare,
  Map,
  Ticket,
  UtensilsCrossed,
  BedDouble,
  Navigation,
  Bookmark,
  Star,
  Search,
} from "lucide-solid";
import type { Component } from "solid-js";
import type { ActivityEntry } from "~/lib/recents/types";
import { activityHref } from "~/lib/recents/activity-link";
import { relativeTime } from "~/lib/recents/day-buckets";

/**
 * The icon and the word for one entry.
 *
 * A feed of bare sentences is unreadable — "seafood in Cascais" and "three days
 * in Porto" look identical at a glance, and they went to different places. The
 * badge is what makes the list scannable.
 */
function descriptorFor(entry: ActivityEntry): {
  icon: Component<{ class?: string }>;
  label: string;
} {
  if (entry.kind === "saved_itinerary") return { icon: Bookmark, label: "Saved" };
  if (entry.kind === "favourite") return { icon: Star, label: "Favourite" };

  switch (entry.detail) {
    case "general":
      return { icon: MessageSquare, label: "Chat" };
    case "itinerary":
      return { icon: Map, label: "Itinerary" };
    case "activities":
      return { icon: Ticket, label: "Activities" };
    case "dining":
      return { icon: UtensilsCrossed, label: "Dining" };
    case "accommodation":
      return { icon: BedDouble, label: "Stays" };
    case "nearby":
      return { icon: Navigation, label: "Nearby" };
    default:
      return { icon: Search, label: "Search" };
  }
}

export interface ActivityRowProps {
  entry: ActivityEntry;
  now: Date;
  profileId?: string;
}

export default function ActivityRow(props: ActivityRowProps) {
  const descriptor = () => descriptorFor(props.entry);
  const href = () => activityHref(props.entry, props.profileId);

  return (
    <A
      href={href()}
      class="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-card"
    >
      <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:text-foreground">
        {(() => {
          const Icon = descriptor().icon;
          return <Icon class="h-4 w-4" />;
        })()}
      </span>

      <span class="min-w-0 flex-1">
        <span class="block truncate font-medium text-foreground">{props.entry.label}</span>
        <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{descriptor().label}</span>
          <Show when={props.entry.cityName}>
            <span aria-hidden="true">·</span>
            <span class="truncate">{props.entry.cityName}</span>
          </Show>
        </span>
      </span>

      <span class="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
        {relativeTime(props.entry.occurredAt, props.now)}
      </span>
    </A>
  );
}
