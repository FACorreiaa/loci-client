// The traveller's desk: the question box, the next trip, shortcuts, what is kept,
// and where they have been. Every number here is a real row; sections that
// would be empty are absent rather than zero.
import { createMemo, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useFavoritesList } from "~/lib/api/favorites";
import { useTrips } from "~/lib/api/trips";
import { pickNextTrip } from "~/lib/dashboard/next-trip";
import DeskHero from "./DeskHero";
import NextTripBand from "./NextTripBand";
import InSeasonBand from "./InSeasonBand";
import NewsTickerBand from "./NewsTickerBand";
import KeptSection from "./KeptSection";
import WhereYouveBeen from "./WhereYouveBeen";

const shortcuts = [
  { id: "nearby", label: "Nearby", href: "/discover?category=nearby" },
  { id: "dining", label: "Dining", href: "/discover?category=dining" },
  { id: "weekend", label: "Weekend", href: "/discover?category=weekend" },
  { id: "compare", label: "Compare", href: "/compare" },
] as const;

export default function LoggedInDashboard() {
  const tripsQuery = useTrips();
  const favoritesQuery = useFavoritesList();

  const next = createMemo(() => pickNextTrip(tripsQuery.data ?? [], new Date()));
  const settled = () => !tripsQuery.isLoading && !favoritesQuery.isLoading;

  return (
    <div class="min-h-[100dvh] bg-background text-foreground">
      <div class="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <DeskHero />

        <InSeasonBand />

        <NewsTickerBand />

        <Show when={next()}>{(n) => <NextTripBand next={n()} />}</Show>

        <nav class="mb-10 flex flex-wrap gap-2" aria-label="Shortcuts">
          <For each={shortcuts}>
            {(item) => (
              <A
                href={item.href}
                class="loci-chip--surface rounded-full px-3 py-1.5 text-sm active:scale-[0.98]"
              >
                {item.label}
              </A>
            )}
          </For>
        </nav>

        <KeptSection
          favorites={favoritesQuery.data?.favorites}
          trips={tripsQuery.data ?? []}
          excludeTripId={next()?.trip.id}
          settled={settled()}
        />

        <WhereYouveBeen />
      </div>
    </div>
  );
}
