import { createSignal, For, Show, createMemo } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { MapPin, Loader2, ArrowRight, GitCompare, Car, CloudSun } from "lucide-solid";
import {
  useCompareWeekendMutation,
  recommendationLabel,
  type CityCompareColumn,
} from "~/lib/api/compare";
import type {
  PlannedCity,
  MultiCityPlan,
} from "@buf/loci_loci-proto.bufbuild_es/loci/compare/v1/compare_pb.js";
import type { TripLeg } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { useSaveTrip } from "~/lib/api/trips";
import type { Trip } from "~/lib/api/trips";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { recordRecommendationEvents } from "~/lib/api/recommendations";
import LocalWeather from "~/components/LocalWeather";
import { GoScoreCard } from "~/components/ui/GoScoreCard";
import { MultiCityPlanCard } from "~/components/ui/MultiCityPlanCard";
import WhyThisStop from "~/components/poi/WhyThisStop";

const defaultWeekend = () => {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilSat);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(23, 59, 0, 0);
  return { start, end };
};

function ColumnCard(props: { column: CityCompareColumn; onChoose: () => void; choosing: boolean }) {
  const col = () => props.column;
  return (
    <article class="loci-card rounded-2xl p-5 flex flex-col gap-4">
      <header>
        <p class="kicker mb-1">{col().country || "Portugal"}</p>
        <h2 class="font-display text-2xl text-foreground">{col().cityName}</h2>
        <p class="text-sm text-muted-foreground mt-1">
          {Math.round(col().distanceKm)} km · ~{col().travelMins} min drive
        </p>
      </header>

      {/* The verdict goes above the detail: the whole point of /compare is to
          answer "which one", so lead with the answer and let the weather, places
          and pros/cons below justify it. */}
      <Show when={col().goScore}>
        <GoScoreCard score={col().goScore!} />
      </Show>

      <Show when={col().centerLat && col().centerLon}>
        <LocalWeather latitude={col().centerLat} longitude={col().centerLon} days={2} />
      </Show>

      <div>
        <h3 class="text-sm font-semibold mb-2">Top places</h3>
        <ul class="space-y-2">
          <For each={col().topPois.slice(0, 5)}>
            {(poi) => (
              <li class="text-sm">
                <span class="font-medium">{poi.name}</span>
                <Show when={poi.category}>
                  <span class="text-muted-foreground"> · {poi.category}</span>
                </Show>
                <Show when={poi.descriptionPoi || poi.description}>
                  <WhyThisStop reason={poi.descriptionPoi || poi.description || ""} class="mt-1" />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="font-semibold text-accent mb-1">Pros</p>
          <ul class="space-y-1 text-muted-foreground">
            <For each={col().pros}>{(p) => <li>{p}</li>}</For>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-destructive mb-1">Cons</p>
          <ul class="space-y-1 text-muted-foreground">
            <For each={col().cons}>{(c) => <li>{c}</li>}</For>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <For each={col().bookingOptions}>
          {(b) => (
            <a
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              class="loci-hero__action text-xs px-3 py-1.5"
              onClick={() =>
                recordRecommendationEvents([
                  {
                    eventType: "RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED",
                    poiId: col().cityId,
                    trace: {
                      runId: "compare",
                      itemId: col().cityId,
                      rank: 0,
                      algorithmVersion: "compare-v1",
                      experimentVariant: "default",
                      surface: "RECOMMENDATION_SURFACE_DISCOVER",
                      channel: "RECOMMENDATION_CHANNEL_WEB",
                    },
                    metadata: { provider: b.provider, surface: "compare" },
                  },
                ])
              }
            >
              {b.label}
            </a>
          )}
        </For>
        <For each={col().transportOptions.filter((t: { url?: string }) => t.url)}>
          {(t) => (
            <a
              href={t.url!}
              target="_blank"
              rel="noopener noreferrer"
              class="loci-chip text-xs inline-flex items-center gap-1"
            >
              <Car class="w-3 h-3" />
              {t.summary}
            </a>
          )}
        </For>
      </div>

      <button
        type="button"
        class="loci-hero__action w-full justify-center mt-auto"
        disabled={props.choosing}
        onClick={props.onChoose}
      >
        {props.choosing ? (
          <Loader2 class="w-4 h-4 animate-spin" />
        ) : (
          <>
            Choose {col().cityName}
            <ArrowRight class="w-4 h-4" />
          </>
        )}
      </button>
    </article>
  );
}

export default function ComparePage() {
  const navigate = useNavigate();
  const compareMutation = useCompareWeekendMutation();
  const saveTrip = useSaveTrip();

  const weekend = defaultWeekend();
  const [origin, setOrigin] = createSignal("Porto");
  const [candidates, setCandidates] = createSignal("Évora, Beja");
  const [choosingCity, setChoosingCity] = createSignal<string | null>(null);

  const result = createMemo(() => compareMutation.data);
  const columns = createMemo(() => result()?.columns ?? []);

  const runCompare = () => {
    const names = candidates()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length < 2) return;
    compareMutation.mutate({
      originCity: origin(),
      candidates: names,
      startDate: weekend.start,
      endDate: weekend.end,
    });
  };

  const saveFromColumn = async (col: CityCompareColumn, dual?: boolean) => {
    setChoosingCity(col.cityName);
    try {
      const stops = col.topPois.slice(0, 4).map((p: { id: string; name: string }, i: number) => ({
        id: "",
        poiId: p.id,
        orderIndex: i,
        name: p.name,
        notes: "",
      }));
      const days = dual
        ? [
            {
              id: "",
              dayNumber: 1,
              stops: stops.slice(0, 2),
            },
            {
              id: "",
              dayNumber: 2,
              stops: stops.slice(2, 4),
            },
          ]
        : [{ id: "", dayNumber: 1, stops }];

      const tripPayload: Trip = {
        id: "",
        userId: "",
        cityName: col.cityName,
        cityId: col.cityId,
        title: dual
          ? `Weekend: ${columns()[0]?.cityName} + ${columns()[1]?.cityName}`
          : `${col.cityName} weekend`,
        constraints: { pace: TripPace.MODERATE, interests: [] },
        days,
        version: 0n,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveTrip.mutateAsync({
        trip: tripPayload,
        baseVersion: 0n,
      });
      navigate(`/trips/${saved.id}`);
    } finally {
      setChoosingCity(null);
    }
  };

  // Save the planned route as a genuine multi-city trip: every day carries its
  // own city, stops come from that city's column, and the legs travel with it.
  // This is what "do all of these" used to only describe in prose.
  const saveFromPlan = async () => {
    const plan = result()?.multiCityPlan;
    if (!plan || !plan.feasible || plan.cities.length === 0) return;

    setChoosingCity("__route__");
    try {
      const columnFor = (cityName: string) => columns().find((c) => c.cityName === cityName);

      const days = plan.cities.flatMap((city: PlannedCity) => {
        const col = columnFor(city.cityName);
        const pois = col?.topPois ?? [];
        return city.dayNumbers.map((dayNumber: number, dayIdx: number) => ({
          id: "",
          dayNumber,
          cityName: city.cityName,
          cityId: city.cityId,
          cityLat: city.lat,
          cityLon: city.lon,
          // The first day in each city is when you arrive.
          travelDay: dayIdx === 0,
          // Spread the city's places across its days rather than piling them all
          // onto day one.
          stops: pois
            .filter((_, i) => i % city.dayNumbers.length === dayIdx)
            .slice(0, 4)
            .map((poi: { id: string; name: string }, i: number) => ({
              id: "",
              poiId: poi.id,
              orderIndex: i,
              name: poi.name,
              notes: "",
            })),
        }));
      });

      const tripPayload: Trip = {
        id: "",
        userId: "",
        cityName: plan.cities[0].cityName,
        cityId: plan.cities[0].cityId,
        title: plan.cities.map((c: PlannedCity) => c.cityName).join(" + "),
        constraints: { pace: TripPace.MODERATE, interests: [] },
        days,
        legs: plan.legs.map((l: TripLeg) => ({
          fromName: l.fromName,
          toName: l.toName,
          fromLat: l.fromLat,
          fromLon: l.fromLon,
          toLat: l.toLat,
          toLon: l.toLon,
          distanceKm: l.distanceKm,
          durationMins: l.durationMins,
          afterDay: l.afterDay,
          mode: l.mode,
        })),
        version: 0n,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveTrip.mutateAsync({ trip: tripPayload, baseVersion: 0n });
      navigate(`/trips/${saved.id}`);
    } finally {
      setChoosingCity(null);
    }
  };

  return (
    <>
      <Title>Weekend city compare · Loci</Title>
      <Meta name="description" content="Compare nearby cities for a weekend trip." />

      <div class="max-w-6xl mx-auto px-4 py-8 pb-24">
        <header class="mb-8">
          <p class="kicker mb-2">Weekend compare</p>
          <h1 class="font-display text-3xl sm:text-4xl text-foreground flex items-center gap-2">
            <GitCompare class="w-8 h-8 text-primary" />
            Which city this weekend?
          </h1>
          <p class="text-muted-foreground mt-2 max-w-xl">
            Same window, side-by-side POIs, weather, and drive time — pick one city or a split plan.
          </p>
        </header>

        <form
          class="loci-card rounded-2xl p-5 mb-8 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            runCompare();
          }}
        >
          <label class="block">
            <span class="text-sm font-medium">From</span>
            <div class="mt-1 flex items-center gap-2 rounded-lg border px-3 py-2">
              <MapPin class="w-4 h-4 text-muted-foreground" />
              <input
                class="flex-1 bg-transparent outline-none"
                value={origin()}
                onInput={(e) => setOrigin(e.currentTarget.value)}
                placeholder="Porto"
              />
            </div>
          </label>
          <label class="block sm:col-span-2">
            <span class="text-sm font-medium">Candidates (comma-separated)</span>
            <input
              class="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent"
              value={candidates()}
              onInput={(e) => setCandidates(e.currentTarget.value)}
              placeholder="Évora, Beja"
            />
          </label>
          <button
            type="submit"
            class="loci-hero__action sm:col-span-3 justify-center"
            disabled={compareMutation.isPending}
          >
            {compareMutation.isPending ? (
              <>
                <Loader2 class="w-4 h-4 animate-spin" /> Comparing…
              </>
            ) : (
              "Compare weekend"
            )}
          </button>
        </form>

        <Show when={compareMutation.error}>
          <div class="loci-card rounded-2xl p-4 border-destructive/40 text-destructive mb-6">
            {(compareMutation.error as Error).message ||
              "Compare failed — check city names and try again."}
          </div>
        </Show>

        <Show when={result()}>
          {(data) => (
            <>
              <Show when={data().recommendationReason}>
                <p class="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                  <CloudSun class="w-4 h-4" />
                  {data().recommendationReason}
                  <span class="loci-chip text-xs ml-2">
                    {recommendationLabel(data().recommendation, data().columns)}
                  </span>
                </p>
              </Show>

              <div class="grid gap-6 md:grid-cols-2">
                <For each={data().columns}>
                  {(col) => (
                    <ColumnCard
                      column={col}
                      choosing={choosingCity() === col.cityName}
                      onChoose={() => saveFromColumn(col)}
                    />
                  )}
                </For>
              </div>

              {/* The planned route. Replaces the old "both cities?" yes/no —
                  it handles any number of cities over any number of days, shows
                  the day split and driving, and says what it left out. */}
              <Show when={data().multiCityPlan}>
                {(plan) => (
                  <div class="mt-8">
                    <MultiCityPlanCard
                      plan={plan() as MultiCityPlan}
                      saving={choosingCity() === "__route__"}
                      onSave={saveFromPlan}
                    />
                  </div>
                )}
              </Show>
            </>
          )}
        </Show>
      </div>
    </>
  );
}
