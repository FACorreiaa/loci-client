import { For, Show } from "solid-js";
import { ArrowDown, ArrowUp, ExternalLink, Trash2, Utensils } from "lucide-solid";
import type { ItineraryDayMeta } from "@/lib/itinerary/trip-view";

export interface StopActionsProps {
  stopName: string;
  /** The stop on Google Maps, by name: where its reviews and photos are. */
  mapsHref?: string | null;
  onMapsOpen?: () => void;
  /** Present when there is somewhere to look for food around this stop. */
  onEatNearby?: () => void;
  eatNearbyOpen?: boolean;
  /** The rest only appears for a stop of a trip the viewer may edit. */
  editable?: boolean;
  busy?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  /** Days the stop could move to: every day of the trip but its own. */
  otherDays?: ItineraryDayMeta[];
  onNudge?: (direction: "up" | "down") => void;
  onMoveToDay?: (dayId: string) => void;
  onRemove?: () => void;
}

const link =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * The row of things to do with one stop, under its card: check it on Google,
 * find food near it, and, on an editable trip, move or remove it.
 */
export default function StopActions(props: StopActionsProps) {
  return (
    <div class="-mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 pl-1">
      <Show when={props.mapsHref}>
        {(href) => (
          <a
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            class={link}
            aria-label={`${props.stopName} on Google Maps (opens in a new tab)`}
            onClick={() => props.onMapsOpen?.()}
          >
            <ExternalLink class="h-3.5 w-3.5" />
            Google Maps
          </a>
        )}
      </Show>

      <Show when={props.onEatNearby}>
        <button
          type="button"
          class={link}
          aria-expanded={props.eatNearbyOpen ? "true" : "false"}
          onClick={() => props.onEatNearby?.()}
        >
          <Utensils class="h-3.5 w-3.5" />
          Eat nearby
        </button>
      </Show>

      <Show when={props.editable}>
        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          class={link}
          disabled={props.busy || props.isFirst}
          aria-label={`Move ${props.stopName} earlier`}
          onClick={() => props.onNudge?.("up")}
        >
          <ArrowUp class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class={link}
          disabled={props.busy || props.isLast}
          aria-label={`Move ${props.stopName} later`}
          onClick={() => props.onNudge?.("down")}
        >
          <ArrowDown class="h-3.5 w-3.5" />
        </button>
        <Show when={(props.otherDays?.length ?? 0) > 0}>
          <label class="inline-flex items-center">
            <span class="sr-only">Move {props.stopName} to another day</span>
            <select
              class="h-7 rounded-md border border-transparent bg-transparent px-1 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              disabled={props.busy}
              onChange={(e) => {
                const dayId = e.currentTarget.value;
                e.currentTarget.value = "";
                if (dayId) props.onMoveToDay?.(dayId);
              }}
            >
              <option value="">Move to…</option>
              <For each={props.otherDays}>
                {(day) => <option value={day.dayId}>{day.label}</option>}
              </For>
            </select>
          </label>
        </Show>
        <button
          type="button"
          class={`${link} hover:text-destructive`}
          disabled={props.busy}
          aria-label={`Remove ${props.stopName} from the trip`}
          onClick={() => props.onRemove?.()}
        >
          <Trash2 class="h-3.5 w-3.5" />
          Remove
        </button>
      </Show>
    </div>
  );
}
