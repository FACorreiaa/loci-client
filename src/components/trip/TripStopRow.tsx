import { Show, type JSX } from "solid-js";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MoreHorizontal,
  Replace as ReplaceIcon,
  Star,
  Trash2,
  Check,
} from "lucide-solid";
import { cn } from "~/cn";
import { Badge } from "~/ui/badge";
import { Button, buttonVariants } from "~/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/ui/dropdown-menu";
import WhyThisStop from "~/components/poi/WhyThisStop";
import { formatDuration, hhmmToMinutes, minutesToHHMM } from "~/lib/trip-format";
import type { TripStop } from "~/lib/api/trips";
import type { RecommendationEventName } from "~/lib/api/recommendations";

export interface TripStopRowProps {
  stop: TripStop;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** Read mode renders a timeline entry; edit mode swaps in the controls. */
  editing: boolean;
  /** The day's colour from the map day scale, so list and map agree. */
  dotColor: string;
  replacing: boolean;
  removeConfirming: boolean;
  onMove: (dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onRetime: (startMinute?: number, durationMinutes?: number) => void;
  onToggleReplace: () => void;
  /** Called for both steps of the remove confirmation. */
  onRemove: () => void;
  onCancelRemove: () => void;
  onOutcome: (eventType: RecommendationEventName, rating?: number) => void;
  /** The replace PlacePicker, rendered when `replacing`. */
  children?: JSX.Element;
}

const timeInputClass =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * One stop on the day's timeline.
 *
 * Read mode is the default and carries no form chrome at all — start time on
 * the rail, name as a heading, duration as a chip. Every secondary action
 * lives behind one overflow menu so a stop reads as a place rather than as a
 * row of inputs.
 */
export default function TripStopRow(props: TripStopRowProps) {
  const duration = () => formatDuration(props.stop.durationMinutes);
  const startLabel = () => minutesToHHMM(props.stop.startMinute);

  const overflowMenu = () => (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger
        class={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "shrink-0 text-muted-foreground hover:text-foreground",
        )}
        aria-label={`Actions for ${props.stop.name}`}
      >
        <MoreHorizontal class="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-52">
        <DropdownMenuItem onSelect={props.onToggleReplace}>
          <ReplaceIcon class="mr-2 h-4 w-4" aria-hidden="true" />
          {props.replacing ? "Close search" : "Replace stop"}
        </DropdownMenuItem>

        <Show when={props.stop.bookingUrl}>
          <DropdownMenuItem
            onSelect={() => {
              props.onOutcome("RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED");
              window.open(props.stop.bookingUrl!, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink class="mr-2 h-4 w-4" aria-hidden="true" />
            Open booking
          </DropdownMenuItem>
        </Show>

        <Show when={props.stop.recommendationTrace}>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => props.onOutcome("RECOMMENDATION_EVENT_TYPE_KEPT_IN_TRIP")}
          >
            <Check class="mr-2 h-4 w-4" aria-hidden="true" />
            Keep this stop
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => props.onOutcome("RECOMMENDATION_EVENT_TYPE_VISIT_CONFIRMED")}
          >
            <Check class="mr-2 h-4 w-4" aria-hidden="true" />
            Mark visited
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Star class="mr-2 h-4 w-4" aria-hidden="true" />
              Rate this stop
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[1, 2, 3, 4, 5].map((rating) => (
                <DropdownMenuItem
                  onSelect={() => props.onOutcome("RECOMMENDATION_EVENT_TYPE_RATED", rating)}
                >
                  {rating} / 5
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </Show>

        <DropdownMenuSeparator />
        <DropdownMenuItem class="text-destructive" onSelect={props.onRemove}>
          <Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <li class="motion-enter group grid grid-cols-[2.75rem_1fr] gap-x-1 sm:grid-cols-[3.75rem_1fr] sm:gap-x-2">
      {/* Rail gutter: the clock in read mode, the stop's position in edit mode. */}
      <div class="pt-2 text-right">
        <span class="font-coord text-[11px] tabular-nums text-muted-foreground sm:text-xs">
          <Show when={!props.editing} fallback={String(props.index + 1).padStart(2, "0")}>
            {startLabel() || "—"}
          </Show>
        </span>
      </div>

      {/* Rail line + dot, then the stop itself. */}
      <div class="relative border-l border-border pb-4 pl-4 sm:pl-5">
        <span
          class="absolute left-0 top-[0.85rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-background"
          style={{ "background-color": props.dotColor }}
          aria-hidden="true"
        />

        <Show
          when={props.editing}
          fallback={
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-medium leading-snug text-foreground">
                  {props.stop.name}
                </h3>
                <WhyThisStop reason={props.stop.notes} />
              </div>
              <Show when={duration()}>
                <Badge variant="secondary" class="mt-0.5 shrink-0 font-coord tabular-nums">
                  {duration()}
                </Badge>
              </Show>
              <div class="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {overflowMenu()}
              </div>
            </div>
          }
        >
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex shrink-0 flex-col">
              <Button
                variant="ghost"
                size="icon"
                class="h-5 w-7 text-muted-foreground"
                disabled={props.isFirst}
                onClick={() => props.onMove(-1)}
                aria-label={`Move ${props.stop.name} up`}
              >
                <ChevronUp class="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-5 w-7 text-muted-foreground"
                disabled={props.isLast}
                onClick={() => props.onMove(1)}
                aria-label={`Move ${props.stop.name} down`}
              >
                <ChevronDown class="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <input
              class="h-9 min-w-0 flex-1 basis-48 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={props.stop.name}
              aria-label="Stop name"
              onChange={(e) => props.onRename(e.currentTarget.value)}
            />

            <input
              type="time"
              class={timeInputClass}
              aria-label={`Start time for ${props.stop.name}`}
              value={startLabel()}
              onChange={(e) =>
                props.onRetime(hhmmToMinutes(e.currentTarget.value), props.stop.durationMinutes)
              }
            />

            <div class="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                step="15"
                class={`${timeInputClass} w-20 tabular-nums`}
                aria-label={`Duration in minutes for ${props.stop.name}`}
                value={props.stop.durationMinutes ?? ""}
                onChange={(e) =>
                  props.onRetime(
                    props.stop.startMinute,
                    e.currentTarget.value ? Number(e.currentTarget.value) : 0,
                  )
                }
              />
              <span class="font-coord text-[11px] uppercase tracking-wide text-muted-foreground">
                min
              </span>
            </div>

            {overflowMenu()}
          </div>

          <WhyThisStop reason={props.stop.notes} />
        </Show>

        {/* Remove is a two-step confirmation: the menu arms it, this bar commits. */}
        <Show when={props.removeConfirming}>
          <div class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <span class="text-destructive">Remove this stop?</span>
            <div class="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={props.onCancelRemove}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={props.onRemove}>
                Remove
              </Button>
            </div>
          </div>
        </Show>

        <Show when={props.replacing}>
          <div class="mt-3">{props.children}</div>
        </Show>
      </div>
    </li>
  );
}
