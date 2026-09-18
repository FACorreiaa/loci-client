import { createMemo, createSignal, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useParams, useSearchParams, useNavigate, A } from "@solidjs/router";
import { Lock, Loader2, ArrowRight } from "lucide-solid";
import ItineraryStreamView from "~/components/itinerary/ItineraryStreamView";
import SplitView from "~/components/layout/SplitView";
import { lazyChunk } from "~/lib/lazyChunk";
import { useAuth } from "~/contexts/AuthContext";
import { usePack, useCreatePackCheckout, useClaimPack } from "~/lib/api/bundles";
import { monthsLabel, priceLabel, themeLabel } from "~/lib/bundles/themes";

// Mapbox is a large chunk and most of the page is readable without it, so it
// loads on its own rather than blocking the itinerary.
const MapComponent = lazyChunk(() => import("~/components/features/Map/Map"));

/**
 * How much of this pack the reader may see.
 *
 * A plain boolean is wrong here for the same reason it was wrong in TripKit:
 * `previewTruncated` reads false while the query is still pending *and* when
 * the reader genuinely owns the pack. Used directly it flashes the full pack
 * during load, and inverted it shows a paywall to somebody who has just paid.
 * The four states keep those apart.
 */
type Access = "loading" | "unknown" | "unlocked" | "locked";

export default function PackDetailPage() {
  const params = useParams<{ slug: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const packQuery = usePack(() => params.slug);
  const checkout = useCreatePackCheckout();
  const claim = useClaimPack();

  const detail = () => packQuery.data ?? null;
  const pack = () => detail()?.pack;

  const access = createMemo<Access>(() => {
    if (packQuery.isPending) return "loading";
    if (packQuery.isError || !detail()) return "unknown";
    return detail()!.lockedDayCount > 0 ? "locked" : "unlocked";
  });

  // The webhook that grants a pack can land after Stripe sends the buyer back.
  // Rather than telling somebody who just paid that they have not, poll while
  // the page still looks locked.
  const justPurchased = () => search.purchased === "1";
  const stops = createMemo(() => detail()?.days.flatMap((d) => d.stops) ?? []);
  const points = createMemo(() => detail()?.points ?? []);

  // Selection is shared both ways: clicking a marker highlights the row, and
  // clicking a row flies the map to it.
  const [selectedKey, setSelectedKey] = createSignal<string | undefined>();

  // Centre on the first stop that has one. A pack whose stops all lack
  // positions shows no map rather than the Atlantic.
  const center = createMemo<[number, number] | null>(() => {
    const first = points()[0];
    return first ? [first.longitude, first.latitude] : null;
  });

  const startCheckout = async () => {
    const p = pack();
    if (!p) return;
    if (!isAuthenticated()) {
      navigate(`/auth/signin?next=/packs/${p.slug}`);
      return;
    }
    const origin = window.location.origin;
    const res = await checkout.mutateAsync({
      bundleId: p.id,
      successUrl: `${origin}/packs/${p.slug}?purchased=1`,
      cancelUrl: `${origin}/packs/${p.slug}`,
    });
    window.location.href = res.url;
  };

  const openAsTrip = async () => {
    const p = pack();
    if (!p) return;
    if (!isAuthenticated()) {
      navigate(`/auth/signin?next=/packs/${p.slug}`);
      return;
    }
    const tripId = await claim.mutateAsync(p.id);
    navigate(`/trips/${tripId}`);
  };

  return (
    <main class="mx-auto w-full max-w-6xl px-4 py-8">
      <Title>{pack()?.title ? `${pack()!.title} | Loci` : "City Pack | Loci"}</Title>
      <Meta
        name="description"
        content={pack()?.summary ?? "A ready-made city itinerary from Loci."}
      />
      <Meta property="og:title" content={pack()?.title ?? "City Pack"} />
      <Meta property="og:description" content={pack()?.summary ?? ""} />
      <Meta property="og:url" content={`https://lociai.fyi/packs/${params.slug}`} />

      <A
        href="/packs"
        class="font-coord text-[0.65rem] uppercase tracking-widest text-muted-foreground"
      >
        ← All packs
      </A>

      <Show
        when={access() !== "loading"}
        fallback={
          <div class="mt-6 space-y-4" aria-busy="true">
            <div class="loci-card h-24 animate-pulse" />
            <div class="loci-card h-64 animate-pulse" />
          </div>
        }
      >
        <Show
          when={detail()}
          fallback={
            <p class="mt-8 text-sm text-muted-foreground">
              That pack is not available.{" "}
              <A href="/packs" class="underline">
                Browse the others
              </A>
              .
            </p>
          }
        >
          <header class="mt-3">
            <p class="font-coord text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {pack()!.cityName}
            </p>
            <h1 class="editorial-title mt-1">{pack()!.title}</h1>
            <Show when={pack()!.summary}>
              <p class="editorial-lead mt-2 max-w-2xl">{pack()!.summary}</p>
            </Show>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="loci-chip loci-chip--surface">{themeLabel(pack()!.theme)}</span>
              <span class="loci-chip loci-chip--surface">{monthsLabel(pack()!.months)}</span>
              <span class="loci-chip loci-chip--surface">
                {pack()!.dayCount} days · {pack()!.stopCount} stops
              </span>
            </div>
          </header>

          <Show
            when={center()}
            fallback={
              <div class="mt-6">
                <ItineraryStreamView
                  phase="done"
                  title={pack()!.title}
                  summary=""
                  stops={stops()}
                  enrichedCount={stops().length}
                  selectedKey={selectedKey()}
                  onStopClick={(s) => setSelectedKey(s.key)}
                />
              </div>
            }
          >
            <div class="mt-6 h-[70vh] overflow-hidden rounded-2xl border border-border">
              <SplitView
                initialMode="split"
                listContent={
                  <div class="h-full overflow-y-auto p-4">
                    <ItineraryStreamView
                      phase="done"
                      title={pack()!.title}
                      summary=""
                      stops={stops()}
                      enrichedCount={stops().length}
                      selectedKey={selectedKey()}
                      onStopClick={(s) => setSelectedKey(s.key)}
                    />
                  </div>
                }
                mapContent={
                  <div class="relative h-full w-full bg-muted">
                    <MapComponent
                      center={center()!}
                      zoom={12}
                      pointsOfInterest={points()}
                      selectedId={selectedKey()}
                      onSelect={(poi) => setSelectedKey(poi.id)}
                      showRoutes
                    />
                  </div>
                }
              />
            </div>
          </Show>

          <Show when={points().length < stops().length}>
            <p class="mt-2 text-xs text-muted-foreground">
              {stops().length - points().length} of {stops().length} stops have no position yet and
              are not on the map.
            </p>
          </Show>

          <Show when={access() === "locked"}>
            <section class="loci-card mt-6 p-6 text-center">
              <Lock class="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 class="mt-2 text-lg font-semibold">
                {detail()!.lockedDayCount} more {detail()!.lockedDayCount === 1 ? "day" : "days"} in
                this pack
              </h2>
              <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Day one is free to read so you can judge it before paying. The rest unlocks once,
                for good — it is a single purchase, not a subscription.
              </p>

              <Show
                when={!justPurchased()}
                fallback={
                  <p class="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
                    Payment received — unlocking. This can take a moment; refresh if it lingers.
                  </p>
                }
              >
                <button
                  type="button"
                  class="loci-hero__action loci-hero__action--strong mt-4"
                  disabled={checkout.isPending}
                  onClick={() => void startCheckout()}
                >
                  <Show when={!checkout.isPending} fallback={<>Opening checkout…</>}>
                    Unlock for {priceLabel(pack()!.priceCents, pack()!.currency)}
                  </Show>
                </button>
              </Show>

              <Show when={checkout.isError}>
                <p class="mt-3 text-sm text-destructive">
                  Checkout could not be opened. Nothing was charged — try again in a moment.
                </p>
              </Show>
            </section>
          </Show>

          <Show when={access() === "unlocked"}>
            <section class="loci-card mt-6 flex flex-col items-center gap-3 p-6 text-center">
              <h2 class="text-lg font-semibold">Make it yours</h2>
              <p class="max-w-md text-sm text-muted-foreground">
                Open this pack as a trip you can edit, reorder and export. It becomes your own copy
                — later changes to the pack will not touch it.
              </p>
              <button
                type="button"
                class="loci-hero__action loci-hero__action--strong inline-flex items-center gap-2"
                disabled={claim.isPending}
                onClick={() => void openAsTrip()}
              >
                <Show when={!claim.isPending} fallback={<>Creating your trip…</>}>
                  Open as my trip <ArrowRight class="h-4 w-4" aria-hidden="true" />
                </Show>
              </button>
              <Show when={claim.isError}>
                <p class="text-sm text-destructive">That did not save. Try again in a moment.</p>
              </Show>
            </section>
          </Show>

          <Show when={pack()!.isPaid}>
            <p class="mt-6 text-center text-xs text-muted-foreground">
              Written with AI assistance and checked by a person before publishing. Opening hours
              and prices change — confirm before you go.
            </p>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
