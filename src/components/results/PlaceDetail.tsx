import { For, Show, createMemo, createSignal, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import {
  ArrowLeft,
  Star,
  MapPin,
  Phone,
  Globe,
  Navigation,
  AlertCircle,
  RefreshCw,
} from "lucide-solid";
import { lazyChunk } from "~/lib/lazyChunk";
import ProgressiveImage from "~/components/itinerary/ProgressiveImage";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { ShareMenu } from "~/components/ShareMenu";
import { Skeleton } from "~/ui/skeleton";
import type { FavoriteItem } from "~/lib/api/favorites";
import type { POIImageCredit } from "~/lib/api/types";
import { SHARE_HOME_URL, type SharePayload } from "~/lib/share";
import { buildAppleMapsUrl, buildGoogleMapsUrl } from "~/lib/trip-kit";
import { DOMAINS, type ResultsDomain } from "~/lib/results/domain";
import { backToResultsHref } from "~/lib/results/last-session";
import type { POI } from "~/components/features/Map/types";

const MapComponent = lazyChunk(() => import("~/components/features/Map/Map"));

/** What every detail page shows above its tabs, whatever the kind of place. */
export interface PlaceSummary {
  id: string;
  name: string;
  city?: string;
  category?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  image_credits?: POIImageCredit[];
  phone?: string;
  website?: string;
}

export interface PlaceTab {
  id: string;
  label: string;
  content: () => JSX.Element;
}

export interface PlaceDetailProps {
  domain: ResultsDomain;
  /** The query's state; the page renders one of loading, not found, error, or the place. */
  status: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  place: PlaceSummary | undefined;
  favorite: FavoriteItem | undefined;
  /** The line under the title: stars, cuisine, price band. */
  facts?: JSX.Element;
  tabs: PlaceTab[];
  /** The city to fall back to for the Back link when no list session is known. */
  cityHint?: string;
  /** Where Back goes when the page was not opened from a results list, e.g. /saved. */
  backTo?: { href: string; label: string };
}

const isNotFound = (err: unknown): boolean =>
  /not found/i.test(err instanceof Error ? err.message : String(err ?? ""));

/**
 * The frame of /hotels/[id], /restaurants/[id] and /places/[id]: Back to where it came
 * from, pictures with their credits, name and actions, tabs. It renders a
 * skeleton while loading, a not-found card for an id that names nothing, and
 * an error card with retry otherwise — the pages used to render nothing at
 * all in every one of those states.
 */
export default function PlaceDetail(props: PlaceDetailProps) {
  const meta = () => DOMAINS[props.domain];
  const [tab, setTab] = createSignal(props.tabs[0]?.id ?? "overview");
  const [heroIndex, setHeroIndex] = createSignal(0);

  const backHref = () =>
    props.backTo?.href ?? backToResultsHref(props.domain, props.cityHint || props.place?.city);
  const backLabel = () => props.backTo?.label ?? `Back to ${meta().label.toLowerCase()}`;
  const images = () => props.place?.images ?? [];
  const hero = () => images()[heroIndex()] ?? images()[0];
  const credit = createMemo(() => props.place?.image_credits?.find((c) => c.url === hero()));
  const creditText = () => {
    const c = credit();
    return c ? [c.attribution, c.licence].filter(Boolean).join(" · ") : "";
  };

  const sharePayload = (): SharePayload => ({
    cityName: props.place?.city ?? "",
    title: props.place?.name ?? meta().label,
    description: props.place?.description,
    url: SHARE_HOME_URL,
  });

  const pin = (): POI[] => {
    const p = props.place;
    if (!p || !p.latitude || !p.longitude) return [];
    return [
      {
        id: p.id,
        name: p.name,
        category: p.category ?? "",
        latitude: p.latitude,
        longitude: p.longitude,
        rating: p.rating,
      },
    ];
  };

  const place = () => ({
    latitude: props.place?.latitude,
    longitude: props.place?.longitude,
    name: props.place?.name,
  });

  return (
    <div class="min-h-screen bg-background">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <A
          href={backHref()}
          class="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-4"
        >
          <ArrowLeft class="w-4 h-4" />
          {backLabel()}
        </A>

        <Show when={props.status.isPending}>
          <div class="flex flex-col lg:flex-row gap-6" aria-busy="true" aria-label="Loading">
            <div class="lg:w-1/2 space-y-2">
              <Skeleton class="aspect-video w-full rounded-2xl" />
              <div class="grid grid-cols-3 gap-2">
                <Skeleton class="aspect-video rounded-lg" />
                <Skeleton class="aspect-video rounded-lg" />
                <Skeleton class="aspect-video rounded-lg" />
              </div>
            </div>
            <div class="lg:w-1/2 space-y-3">
              <Skeleton class="h-9 w-2/3" />
              <Skeleton class="h-4 w-1/3" />
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-24 w-full" />
            </div>
          </div>
        </Show>

        <Show when={props.status.isError}>
          <Show
            when={!isNotFound(props.status.error)}
            fallback={
              <div class="loci-card rounded-2xl p-8 text-center space-y-3 max-w-xl mx-auto">
                <p class="text-3xl">{meta().emoji}</p>
                <p class="font-display text-xl text-foreground">
                  We couldn't find that {meta().singular}
                </p>
                <p class="text-sm text-muted-foreground">
                  It may have been removed, or the link is from a list that has since changed.
                </p>
                <A href={backHref()} class="loci-hero__action mx-auto">
                  {backLabel()}
                </A>
              </div>
            }
          >
            <div
              role="alert"
              class="max-w-xl mx-auto rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive flex items-start gap-3"
            >
              <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="font-bold">Couldn't load this {meta().singular}</p>
                <p class="text-sm opacity-90">
                  {props.status.error instanceof Error
                    ? props.status.error.message
                    : "Something went wrong."}
                </p>
                <button
                  type="button"
                  onClick={() => void props.status.refetch()}
                  class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:no-underline"
                >
                  <RefreshCw class="w-3.5 h-3.5" />
                  Try again
                </button>
              </div>
            </div>
          </Show>
        </Show>

        <Show when={!props.status.isPending && !props.status.isError && props.place}>
          {(p) => (
            <>
              <div class="flex flex-col lg:flex-row gap-6">
                {/* Pictures, with the credit the licence requires beside them */}
                <div class="lg:w-1/2">
                  <Show
                    when={hero()}
                    fallback={
                      <div class="aspect-video rounded-2xl border border-border bg-muted/50 flex items-center justify-center text-5xl">
                        {meta().emoji}
                      </div>
                    }
                  >
                    <ProgressiveImage
                      src={hero()}
                      alt={p().name}
                      seed={p().id}
                      class="aspect-video w-full rounded-2xl"
                      eager
                    />
                  </Show>
                  <Show when={credit()}>
                    {(c) => (
                      <p class="mt-1 text-[11px] text-muted-foreground">
                        Photo: {creditText()}
                        <Show when={c().source_page_url}>
                          {" · "}
                          <a
                            href={c().source_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="underline hover:text-foreground"
                          >
                            source
                          </a>
                        </Show>
                      </p>
                    )}
                  </Show>
                  <Show when={images().length > 1}>
                    <div class="grid grid-cols-3 gap-2 mt-2">
                      <For each={images().slice(0, 6)}>
                        {(src, i) => (
                          <button
                            type="button"
                            class="aspect-video overflow-hidden rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring"
                            classList={{
                              "border-primary": i() === heroIndex(),
                              "border-border": i() !== heroIndex(),
                            }}
                            onClick={() => setHeroIndex(i())}
                            aria-label={`Picture ${i() + 1} of ${p().name}`}
                          >
                            <ProgressiveImage
                              src={src}
                              alt=""
                              seed={`${p().id}-${i()}`}
                              class="h-full w-full"
                            />
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Name, facts, actions */}
                <div class="lg:w-1/2">
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0">
                      <p class="kicker mb-1">
                        {meta().emoji} {p().category || meta().singular}
                        <Show when={p().city}> · {p().city}</Show>
                      </p>
                      <h1 class="editorial-title text-2xl sm:text-3xl text-foreground">
                        {p().name}
                      </h1>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <Show when={props.favorite}>
                        {(item) => <FavoriteButton item={item()} size="md" />}
                      </Show>
                      <ShareMenu payload={sharePayload()} />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
                    <Show when={p().rating && p().rating! > 0}>
                      <span class="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Star class="w-4 h-4 text-accent fill-current" />
                        {p().rating!.toFixed(1)}
                        <Show when={p().reviewCount}>
                          <span class="font-normal text-muted-foreground">
                            ({p().reviewCount} reviews)
                          </span>
                        </Show>
                      </span>
                    </Show>
                    {props.facts}
                  </div>

                  <Show when={p().address}>
                    <p class="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin class="w-4 h-4 mt-0.5 shrink-0" />
                      {p().address}
                    </p>
                  </Show>
                  <Show when={p().phone}>
                    <a
                      href={`tel:${p().phone}`}
                      class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
                    >
                      <Phone class="w-4 h-4 shrink-0" />
                      {p().phone}
                    </a>
                  </Show>
                  <Show when={p().website}>
                    <a
                      href={p().website}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center gap-2 text-sm text-primary hover:underline mb-2 break-all"
                    >
                      <Globe class="w-4 h-4 shrink-0" />
                      {p().website}
                    </a>
                  </Show>
                </div>
              </div>

              {/* Tabs */}
              <div class="mt-8 border-b border-border flex gap-1 overflow-x-auto" role="tablist">
                <For each={props.tabs}>
                  {(t) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab() === t.id}
                      onClick={() => setTab(t.id)}
                      class="px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                      classList={{
                        "border-primary text-primary": tab() === t.id,
                        "border-transparent text-muted-foreground hover:text-foreground":
                          tab() !== t.id,
                      }}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab() === "location"}
                  onClick={() => setTab("location")}
                  class="px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                  classList={{
                    "border-primary text-primary": tab() === "location",
                    "border-transparent text-muted-foreground hover:text-foreground":
                      tab() !== "location",
                  }}
                >
                  Location
                </button>
              </div>

              <div class="py-6">
                <For each={props.tabs}>
                  {(t) => <Show when={tab() === t.id}>{t.content()}</Show>}
                </For>

                <Show when={tab() === "location"}>
                  <div class="space-y-4">
                    <Show
                      when={pin().length > 0}
                      fallback={
                        <p class="text-sm text-muted-foreground">
                          Loci does not have a verified location for this {meta().singular}.
                        </p>
                      }
                    >
                      <div class="h-80 overflow-hidden rounded-2xl border border-border">
                        <MapComponent
                          center={[p().longitude!, p().latitude!]}
                          pointsOfInterest={pin()}
                          zoom={15}
                          enable3D={false}
                          showRoutes={false}
                        />
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <Show when={buildGoogleMapsUrl(place())}>
                          {(url) => (
                            <a
                              href={url()}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                            >
                              <Navigation class="w-4 h-4" /> Google Maps
                            </a>
                          )}
                        </Show>
                        <Show when={buildAppleMapsUrl(place())}>
                          {(url) => (
                            <a
                              href={url()}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                            >
                              <Navigation class="w-4 h-4" /> Apple Maps
                            </a>
                          )}
                        </Show>
                      </div>
                    </Show>
                    <Show when={p().address}>
                      <p class="text-sm text-muted-foreground">{p().address}</p>
                    </Show>
                  </div>
                </Show>
              </div>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
