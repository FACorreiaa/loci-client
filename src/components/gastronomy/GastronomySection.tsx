import { createMemo, createSignal, For, Show } from "solid-js";
import { ExternalLink, MapPin, Star } from "lucide-solid";
import { cn } from "@/cn";
import SectionHeader from "~/components/ui/SectionHeader";
import {
  DISH_CATEGORY_LABELS,
  dishCategories,
  dishTags,
  EMPTY_DISH_FILTER,
  filterDishes,
  placeMapUrl,
  type DishFilter,
} from "~/lib/api/gastronomy";
import type { CityGastronomy, DishCategory, GastronomyDish } from "~/lib/api/types";

export interface GastronomySectionProps {
  gastronomy: CityGastronomy;
  /**
   * Embedded under an itinerary or discovery result: a smaller header, no
   * traditions or tips, and the first few dishes until expanded.
   */
  compact?: boolean;
  class?: string;
}

const COMPACT_DISHES = 4;

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

const chipClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-sm transition-colors",
    active
      ? "border-transparent bg-primary text-primary-foreground"
      : "border-border bg-card text-muted-foreground hover:text-foreground",
  );

/**
 * A city's typical gastronomy: the overview, filter chips (dish category and
 * main ingredient / diet), and one card per dish with the well-known places
 * to eat it. Filtering is local — every filter reads the one cached answer.
 */
export default function GastronomySection(props: GastronomySectionProps) {
  const [filter, setFilter] = createSignal<DishFilter>(EMPTY_DISH_FILTER);
  const [expanded, setExpanded] = createSignal(false);

  const categories = createMemo(() => dishCategories(props.gastronomy));
  const tags = createMemo(() => dishTags(props.gastronomy));
  const dishes = createMemo(() => filterDishes(props.gastronomy, filter()));
  const visible = createMemo(() =>
    props.compact && !expanded() ? dishes().slice(0, COMPACT_DISHES) : dishes(),
  );
  const filtered = () => filter().categories.length > 0 || filter().tags.length > 0;
  const city = () => props.gastronomy.city_name;

  return (
    <section class={cn("space-y-4", props.class)} aria-label={`Typical gastronomy of ${city()}`}>
      <SectionHeader
        kicker={props.compact ? "Typical gastronomy" : undefined}
        title={props.compact ? `What to eat in ${city()}` : `The food of ${city()}`}
        size={props.compact ? "md" : "lg"}
      />
      <Show when={props.gastronomy.overview}>
        <p class="editorial-lead text-base text-muted-foreground max-w-3xl">
          {props.gastronomy.overview}
        </p>
      </Show>

      <Show when={categories().length > 1 || tags().length > 0}>
        <div class="space-y-2">
          <Show when={categories().length > 1}>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Filter dishes by type">
              <For each={categories()}>
                {(c: DishCategory) => (
                  <button
                    type="button"
                    class={chipClass(filter().categories.includes(c))}
                    aria-pressed={filter().categories.includes(c)}
                    onClick={() =>
                      setFilter((f) => ({ ...f, categories: toggle(f.categories, c) }))
                    }
                  >
                    {DISH_CATEGORY_LABELS[c]}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={tags().length > 0}>
            <div
              class="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter dishes by ingredient or diet"
            >
              <For each={tags()}>
                {(t) => (
                  <button
                    type="button"
                    class={cn(chipClass(filter().tags.includes(t)), "capitalize")}
                    aria-pressed={filter().tags.includes(t)}
                    onClick={() => setFilter((f) => ({ ...f, tags: toggle(f.tags, t) }))}
                  >
                    {t}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show
        when={dishes().length > 0}
        fallback={
          <div class="loci-card p-6 text-sm text-muted-foreground">
            No dishes match these filters.{" "}
            <button
              type="button"
              class="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => setFilter(EMPTY_DISH_FILTER)}
            >
              Clear filters
            </button>
          </div>
        }
      >
        <div class="grid gap-4 md:grid-cols-2">
          <For each={visible()}>{(dish) => <DishCard dish={dish} city={city()} />}</For>
        </div>
      </Show>

      <Show when={props.compact && dishes().length > COMPACT_DISHES}>
        <button
          type="button"
          class="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded() ? "Show fewer dishes" : `Show all ${dishes().length} dishes`}
        </button>
      </Show>

      <Show when={!props.compact && !filtered()}>
        <div class="grid gap-4 md:grid-cols-2">
          <Show when={props.gastronomy.culinary_traditions.length > 0}>
            <InfoList title="Traditions" items={props.gastronomy.culinary_traditions} />
          </Show>
          <Show when={props.gastronomy.dining_tips.length > 0}>
            <InfoList title="Dining tips" items={props.gastronomy.dining_tips} />
          </Show>
        </div>
      </Show>
    </section>
  );
}

function DishCard(props: { dish: GastronomyDish; city: string }) {
  return (
    <article class="loci-card p-5 space-y-3">
      <header class="space-y-1">
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display text-lg font-semibold leading-tight text-foreground">
            {props.dish.name}
          </h3>
          <Show when={props.dish.is_signature}>
            <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              <Star class="h-3 w-3" aria-hidden="true" />
              Signature
            </span>
          </Show>
        </div>
        <Show when={props.dish.local_name && props.dish.local_name !== props.dish.name}>
          <p class="text-sm italic text-muted-foreground">{props.dish.local_name}</p>
        </Show>
        <div class="flex flex-wrap gap-1.5 pt-1">
          <span class="loci-chip loci-chip--surface">
            {DISH_CATEGORY_LABELS[props.dish.category]}
          </span>
          <For each={props.dish.tags}>
            {(t) => <span class="loci-chip loci-chip--surface capitalize font-normal">{t}</span>}
          </For>
        </div>
      </header>
      <Show when={props.dish.description}>
        <p class="text-sm text-foreground/90">{props.dish.description}</p>
      </Show>
      <Show when={props.dish.places.length > 0}>
        <div class="space-y-2 border-t border-border pt-3">
          <p class="kicker">Where to try it</p>
          <ul class="space-y-2">
            <For each={props.dish.places}>
              {(place) => (
                <li class="text-sm">
                  <div class="flex flex-wrap items-baseline gap-x-2">
                    <a
                      href={placeMapUrl(place, props.city)}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                    >
                      <MapPin class="h-3.5 w-3.5" aria-hidden="true" />
                      {place.name}
                    </a>
                    <Show when={place.neighborhood}>
                      <span class="text-muted-foreground">{place.neighborhood}</span>
                    </Show>
                    <Show when={place.price_range}>
                      <span class="text-muted-foreground tabular-nums">{place.price_range}</span>
                    </Show>
                    <Show when={place.website}>
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-muted-foreground hover:text-primary"
                        aria-label={`${place.name} website`}
                      >
                        <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </Show>
                  </div>
                  <Show when={place.why_famous}>
                    <p class="text-muted-foreground">{place.why_famous}</p>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </article>
  );
}

function InfoList(props: { title: string; items: string[] }) {
  return (
    <div class="loci-card p-5">
      <p class="kicker mb-2">{props.title}</p>
      <ul class="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
        <For each={props.items}>{(item) => <li>{item}</li>}</For>
      </ul>
    </div>
  );
}
