import { For, Show, createMemo, createSignal } from "solid-js";
import { Star, X } from "lucide-solid";
import StopCard from "~/components/itinerary/StopCard";
import FavoriteButton from "~/components/shared/FavoriteButton";
import AddToListButton from "~/components/lists/AddToListButton";
import { stopFromPoi, type ItineraryStop } from "~/lib/itinerary/createItineraryStream";
import type { POIDetailedInfo } from "~/lib/api/types";
import { recordRecommendationEvents } from "~/lib/api/recommendations";
import { outcomeEvent, resultKey, withoutDismissed } from "~/lib/results/outcome";
import {
  DOMAINS,
  favoritePayload,
  isOpenNow,
  todayHours,
  type ResultsDomain,
} from "~/lib/results/domain";

export interface ResultsListProps {
  pois: POIDetailedInfo[];
  domain: ResultsDomain;
  /** The page's city, for favourites of places that do not name their own. */
  cityName?: string;
  /** Selected place name (synced with the map). */
  selectedKey?: string;
  onSelect?: (poi: POIDetailedInfo, stop: ItineraryStop) => void;
  /** Show at most this many (chat's compact rendering). */
  limit?: number;
  /** Numbering starts here, so a second list continues the first's count. */
  startIndex?: number;
  /** Default true. Off where saving makes no sense (a preview). */
  showFavorite?: boolean;
  /**
   * Default true. Offers "Not for me" on places Loci recommended (those with a
   * trace), which teaches the taste profile and hides the place.
   */
  dismissible?: boolean;
  /**
   * The parent owns dismissals (it also draws the places on a map): the list
   * records the event and reports the place, and the parent filters `pois`.
   * Without it the list hides dismissed places itself.
   */
  onDismiss?: (poi: POIDetailedInfo) => void;
}

const MAX_AMENITIES = 4;

/**
 * A domain list as stop cards: the same card the itinerary uses, with what
 * each kind of place says about itself in the card's meta slot. The three
 * result pages, chat and the previews all render lists through this, so a
 * hotel looks the same everywhere it appears.
 */
export default function ResultsList(props: ResultsListProps) {
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set());
  const rows = createMemo(() => {
    const start = props.startIndex ?? 0;
    const visible = withoutDismissed(props.pois, dismissed());
    const pois = props.limit ? visible.slice(0, props.limit) : visible;
    return pois.map((poi, i) => ({ poi, stop: stopFromPoi(poi, start + i), index: start + i }));
  });

  const record = (
    poi: POIDetailedInfo,
    type: "RECOMMENDATION_EVENT_TYPE_OPENED" | "RECOMMENDATION_EVENT_TYPE_DISMISSED",
  ) => {
    const event = outcomeEvent(poi, type);
    if (event) void recordRecommendationEvents([event]);
  };

  const dismiss = (poi: POIDetailedInfo) => {
    record(poi, "RECOMMENDATION_EVENT_TYPE_DISMISSED");
    if (props.onDismiss) props.onDismiss(poi);
    else setDismissed((current) => new Set(current).add(resultKey(poi)));
  };

  return (
    <div class="space-y-3">
      <For each={rows()}>
        {(row) => (
          <StopCard
            stop={row.stop}
            index={row.index}
            selected={props.selectedKey === row.poi.name}
            onClick={
              props.onSelect
                ? () => {
                    record(row.poi, "RECOMMENDATION_EVENT_TYPE_OPENED");
                    props.onSelect?.(row.poi, row.stop);
                  }
                : undefined
            }
            meta={<DomainMeta poi={row.poi} domain={props.domain} />}
            action={
              <Show when={props.showFavorite ?? true}>
                <span class="inline-flex items-center gap-1">
                  <FavoriteButton
                    item={favoritePayload(row.poi, props.domain, props.cityName)}
                    size="sm"
                    recommendationTrace={row.poi.recommendation_trace}
                    poiId={row.poi.id}
                  />
                  <AddToListButton
                    itemId={row.poi.id}
                    itemName={row.poi.name}
                    contentType={DOMAINS[props.domain].contentType}
                    size="sm"
                    recommendationTrace={row.poi.recommendation_trace}
                  />
                  <Show when={(props.dismissible ?? true) && row.poi.recommendation_trace}>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Not for me: ${row.poi.name}`}
                      title="Not for me — Loci learns from this"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismiss(row.poi);
                      }}
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </Show>
                </span>
              </Show>
            }
          />
        )}
      </For>
    </div>
  );
}

const Chip = (p: { children: any; tone?: "accent" | "destructive" | "muted" }) => (
  <span
    class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
    classList={{
      "border-accent/30 bg-accent/10 text-accent": p.tone === "accent",
      "border-destructive/30 bg-destructive/10 text-destructive": p.tone === "destructive",
      "border-border bg-muted/40 text-muted-foreground": !p.tone || p.tone === "muted",
    }}
  >
    {p.children}
  </span>
);

/** Hotel: stars and a few amenities. Restaurant: cuisine, today, price. Activity: category. */
function DomainMeta(props: { poi: POIDetailedInfo; domain: ResultsDomain }) {
  const price = () => props.poi.price_range || props.poi.price_level || "";
  const stars = () => {
    const n = Math.round(props.poi.star_rating ?? 0);
    return n > 0 && n <= 5 ? n : 0;
  };
  const amenities = () => (props.poi.amenities ?? []).slice(0, MAX_AMENITIES);
  const hours = () => todayHours(props.poi.opening_hours);
  const open = () => isOpenNow(hours());

  return (
    <div class="flex flex-wrap items-center gap-1.5">
      <Show when={props.domain === "hotels"}>
        <Show when={stars() > 0}>
          <span
            class="inline-flex items-center gap-0.5 text-accent"
            aria-label={`${stars()}-star hotel`}
            title={`${stars()}-star hotel`}
          >
            <For each={Array.from({ length: stars() })}>
              {() => <Star class="h-3 w-3 fill-current" />}
            </For>
          </span>
        </Show>
        <For each={amenities()}>{(a) => <Chip>{a}</Chip>}</For>
        <Show when={price()}>
          <Chip tone="accent">{price()}</Chip>
        </Show>
      </Show>

      <Show when={props.domain === "restaurants"}>
        <Show when={props.poi.cuisine_type}>
          <Chip>{props.poi.cuisine_type}</Chip>
        </Show>
        <Show when={hours()}>
          <span class="inline-flex items-center gap-1">
            <Show when={open() !== undefined}>
              <Chip tone={open() ? "accent" : "destructive"}>{open() ? "Open now" : "Closed"}</Chip>
            </Show>
            <span title="Today's hours">Today {hours()}</span>
          </span>
        </Show>
        <Show when={price()}>
          <Chip tone="accent">{price()}</Chip>
        </Show>
      </Show>

      <Show when={props.domain === "activities"}>
        <Show when={props.poi.category}>
          <Chip>{props.poi.category}</Chip>
        </Show>
        <For each={(props.poi.tags ?? []).slice(0, 3)}>{(t) => <Chip>{t}</Chip>}</For>
        <Show when={price()}>
          <Chip tone="accent">{price()}</Chip>
        </Show>
      </Show>
    </div>
  );
}
