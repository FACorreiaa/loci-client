import { For, Show, createMemo } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { Clock, Check } from "lucide-solid";
import { useRestaurantDetails } from "~/lib/api/restaurants";
import type { FavoriteItem } from "~/lib/api/favorites";
import { isOpenNow, todayHours } from "~/lib/results/domain";
import PlaceDetail, { type PlaceTab } from "~/components/results/PlaceDetail";
import { backFromSaved, decodeParam } from "~/lib/saved/collect";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * One restaurant. Cuisine, price band, today's hours and whether it is open
 * now — derived from the hours, never from a flag: the page used to read
 * `isOpen`, which nothing set, so every restaurant said "Closed". The menu,
 * reservation, card and language sections it used to render were always
 * empty and are gone.
 */
export default function RestaurantDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const restaurantQuery = useRestaurantDetails(decodeParam(params.id));
  const restaurant = () => restaurantQuery.data;

  const today = () => todayHours(restaurant()?.hours);
  const open = () => isOpenNow(today());
  const price = () => restaurant()?.priceRange || restaurant()?.price_level;
  const cuisine = () => restaurant()?.cuisine || restaurant()?.cuisine_type;

  const hoursRows = createMemo(() => {
    const h = restaurant()?.hours;
    if (!h) return [];
    return Object.entries(h).sort(([a], [b]) => {
      const ia = DAY_ORDER.findIndex((d) => d.startsWith(a.toLowerCase().slice(0, 3)));
      const ib = DAY_ORDER.findIndex((d) => d.startsWith(b.toLowerCase().slice(0, 3)));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  });

  const favorite = createMemo<FavoriteItem | undefined>(() => {
    const r = restaurant();
    if (!r) return undefined;
    return {
      id: r.id,
      name: r.name,
      contentType: "restaurant",
      description: r.description,
      llmInteractionId: r.llm_interaction_id || undefined,
      cityName: r.city || (searchParams.cityName as string) || undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      rating: r.rating > 0 ? r.rating : undefined,
      category: r.category || undefined,
    };
  });

  const tabs = createMemo<PlaceTab[]>(() => {
    const r = restaurant();
    const out: PlaceTab[] = [
      {
        id: "overview",
        label: "Overview",
        content: () => (
          <div class="space-y-6">
            <Show when={r?.description}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-3">About this restaurant</h2>
                <p class="text-muted-foreground leading-relaxed">{r?.description}</p>
              </section>
            </Show>
            <section class="bg-card rounded-2xl p-6 border border-border">
              <h2 class="text-lg font-semibold text-foreground mb-4">At a glance</h2>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Show when={cuisine()}>
                  <div>
                    <dt class="text-muted-foreground">Cuisine</dt>
                    <dd class="text-foreground font-medium">{cuisine()}</dd>
                  </div>
                </Show>
                <Show when={price()}>
                  <div>
                    <dt class="text-muted-foreground">Price band</dt>
                    <dd class="text-foreground font-medium">{price()}</dd>
                  </div>
                </Show>
                <Show when={r?.averagePrice}>
                  <div>
                    <dt class="text-muted-foreground">Average price</dt>
                    <dd class="text-foreground font-medium">{r?.averagePrice}</dd>
                  </div>
                </Show>
                <div>
                  <dt class="text-muted-foreground">Today</dt>
                  <dd class="text-foreground font-medium">
                    <Show when={today()} fallback="Hours not available">
                      {today()}
                    </Show>
                  </dd>
                </div>
              </dl>
            </section>
            <Show when={r?.specialties?.length}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-3">Known for</h2>
                <ul class="flex flex-wrap gap-2">
                  <For each={r?.specialties}>
                    {(s) => (
                      <li class="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-foreground">
                        {s}
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>
            <Show when={Array.isArray(r?.features) && r!.features!.length > 0}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-3">Features</h2>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <For each={r?.features as string[]}>
                    {(f) => (
                      <li class="flex items-center gap-2">
                        <Check class="w-4 h-4 text-accent" /> {f}
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>
          </div>
        ),
      },
    ];
    if (hoursRows().length > 0) {
      out.push({
        id: "hours",
        label: "Hours",
        content: () => (
          <dl class="divide-y divide-border rounded-2xl border border-border bg-card">
            <For each={hoursRows()}>
              {([day, hours]) => (
                <div class="flex items-center justify-between px-4 py-3 text-sm">
                  <dt class="capitalize text-foreground">{day}</dt>
                  <dd class={/^closed/i.test(hours) ? "text-destructive" : "text-muted-foreground"}>
                    {hours}
                  </dd>
                </div>
              )}
            </For>
          </dl>
        ),
      });
    }
    return out;
  });

  return (
    <PlaceDetail
      domain="restaurants"
      status={restaurantQuery}
      place={
        restaurant()
          ? {
              id: restaurant()!.id,
              name: restaurant()!.name,
              city: restaurant()!.city,
              category: restaurant()!.category,
              description: restaurant()!.description,
              latitude: restaurant()!.latitude,
              longitude: restaurant()!.longitude,
              address: restaurant()!.address,
              rating: restaurant()!.rating,
              reviewCount: restaurant()!.reviewCount,
              images: restaurant()!.images,
              image_credits: restaurant()!.image_credits,
              phone: restaurant()!.contact?.phone,
              website: restaurant()!.contact?.website,
            }
          : undefined
      }
      favorite={favorite()}
      cityHint={searchParams.cityName as string | undefined}
      backTo={backFromSaved(searchParams.from)}
      facts={
        <>
          <Show when={cuisine()}>
            <span class="text-muted-foreground">{cuisine()}</span>
          </Show>
          <Show when={price()}>
            <span class="font-semibold text-primary">{price()}</span>
          </Show>
          <Show when={today()}>
            <span class="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock class="w-4 h-4" />
              <Show when={open() !== undefined}>
                <span class={open() ? "font-medium text-accent" : "font-medium text-destructive"}>
                  {open() ? "Open now" : "Closed"}
                </span>
                {" · "}
              </Show>
              {today()}
            </span>
          </Show>
        </>
      }
      tabs={tabs()}
    />
  );
}
