import { For, Show, createMemo } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { Star, Wifi, Car, Coffee, Utensils, Check } from "lucide-solid";
import { useHotelDetails } from "~/lib/api/hotels";
import type { FavoriteItem } from "~/lib/api/favorites";
import PlaceDetail, { type PlaceTab } from "~/components/results/PlaceDetail";

const amenityIcon = (amenity: string) => {
  const a = amenity.toLowerCase();
  if (a.includes("wifi") || a.includes("internet")) return <Wifi class="w-4 h-4" />;
  if (a.includes("parking") || a.includes("car")) return <Car class="w-4 h-4" />;
  if (a.includes("breakfast") || a.includes("coffee")) return <Coffee class="w-4 h-4" />;
  if (a.includes("restaurant") || a.includes("dining")) return <Utensils class="w-4 h-4" />;
  return <Check class="w-4 h-4" />;
};

/**
 * One hotel. Shows what the service provides — pictures, class, price band,
 * amenities, contact, location — and nothing it does not: the rooms, check-in
 * times and reviews tabs this page used to render were always empty.
 */
export default function HotelDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const hotelQuery = useHotelDetails(params.id ?? "");
  const hotel = () => hotelQuery.data;

  const stars = () => {
    const n = Math.round(hotel()?.star_rating ?? 0);
    return n > 0 && n <= 5 ? n : 0;
  };
  const price = () => hotel()?.priceRange || hotel()?.price_level;

  const favorite = createMemo<FavoriteItem | undefined>(() => {
    const h = hotel();
    if (!h) return undefined;
    return {
      id: h.id,
      name: h.name,
      contentType: "hotel",
      description: h.description,
      llmInteractionId: h.llm_interaction_id || undefined,
      cityName: h.city || (searchParams.cityName as string) || undefined,
      latitude: h.latitude,
      longitude: h.longitude,
      rating: h.rating > 0 ? h.rating : undefined,
      category: h.category || undefined,
    };
  });

  const tabs = createMemo<PlaceTab[]>(() => {
    const h = hotel();
    const out: PlaceTab[] = [
      {
        id: "overview",
        label: "Overview",
        content: () => (
          <div class="space-y-6">
            <Show when={h?.description}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-3">About this hotel</h2>
                <p class="text-muted-foreground leading-relaxed">{h?.description}</p>
              </section>
            </Show>
            <Show when={price() || h?.pricePerNight || stars() > 0}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-4">At a glance</h2>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Show when={stars() > 0}>
                    <div>
                      <dt class="text-muted-foreground">Class</dt>
                      <dd class="text-foreground font-medium">{stars()}-star</dd>
                    </div>
                  </Show>
                  <Show when={price()}>
                    <div>
                      <dt class="text-muted-foreground">Price band</dt>
                      <dd class="text-foreground font-medium">{price()}</dd>
                    </div>
                  </Show>
                  <Show when={h?.pricePerNight}>
                    <div>
                      <dt class="text-muted-foreground">Per night</dt>
                      <dd class="text-foreground font-medium">{h?.pricePerNight}</dd>
                    </div>
                  </Show>
                </dl>
              </section>
            </Show>
            <Show when={h?.features?.length}>
              <section class="bg-card rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-semibold text-foreground mb-3">Highlights</h2>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <For each={h?.features}>
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
    if (h?.amenities?.length) {
      out.push({
        id: "amenities",
        label: "Amenities",
        content: () => (
          <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={h.amenities}>
              {(a) => (
                <li class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
                  <span class="text-primary">{amenityIcon(a)}</span>
                  {a}
                </li>
              )}
            </For>
          </ul>
        ),
      });
    }
    if (h?.nearbyAttractions?.length) {
      out.push({
        id: "nearby",
        label: "Nearby",
        content: () => (
          <ul class="space-y-2">
            <For each={h.nearbyAttractions}>
              {(n) => (
                <li class="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <span class="text-foreground">
                    {n.name}
                    <Show when={n.type}>
                      <span class="text-muted-foreground"> · {n.type}</span>
                    </Show>
                  </span>
                  <span class="text-muted-foreground">{n.distance}</span>
                </li>
              )}
            </For>
          </ul>
        ),
      });
    }
    return out;
  });

  return (
    <PlaceDetail
      domain="hotels"
      status={hotelQuery}
      place={
        hotel()
          ? {
              id: hotel()!.id,
              name: hotel()!.name,
              city: hotel()!.city,
              category: hotel()!.category,
              description: hotel()!.description,
              latitude: hotel()!.latitude,
              longitude: hotel()!.longitude,
              address: hotel()!.address,
              rating: hotel()!.rating,
              reviewCount: hotel()!.reviewCount,
              images: hotel()!.images,
              image_credits: hotel()!.image_credits,
              phone: hotel()!.contact?.phone,
              website: hotel()!.contact?.website,
            }
          : undefined
      }
      favorite={favorite()}
      cityHint={searchParams.cityName as string | undefined}
      facts={
        <>
          <Show when={stars() > 0}>
            <span
              class="inline-flex items-center gap-0.5 text-accent"
              aria-label={`${stars()}-star hotel`}
            >
              <For each={Array.from({ length: stars() })}>
                {() => <Star class="w-4 h-4 fill-current" />}
              </For>
            </span>
          </Show>
          <Show when={price()}>
            <span class="font-semibold text-primary">{price()}</span>
          </Show>
        </>
      }
      tabs={tabs()}
    />
  );
}
