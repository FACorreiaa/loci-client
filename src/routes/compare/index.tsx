import { createMemo, createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { CloudSun, GitCompare } from "lucide-solid";
import {
  useCompareWeekendMutation,
  recommendationLabel,
  type CompareWeekendInput,
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
import { MultiCityPlanCard } from "~/components/ui/MultiCityPlanCard";
import ErrorView from "~/components/ErrorView";
import { friendlyError } from "~/lib/connect-errors";
import { handleEntitlementError } from "~/lib/entitlement-error";
import { showUpgradePrompt } from "~/lib/upgrade-prompt";
import { citySuggestionsFrom, type CitySuggestion } from "~/lib/compare-suggestions";
import { CompareForm } from "~/components/compare/CompareForm";
import { ColumnCard } from "~/components/compare/ColumnCard";
import { ColumnSkeleton } from "~/components/compare/ColumnSkeleton";
import { CompareEmptyState, type ComparePreset } from "~/components/compare/CompareEmptyState";
import type { CitySelection } from "~/components/compare/CityAutocomplete";

export default function ComparePage() {
  const navigate = useNavigate();
  const compareMutation = useCompareWeekendMutation();
  const saveTrip = useSaveTrip();

  const [choosingCity, setChoosingCity] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  // Bumped to remount the form when a preset or a suggestion prefills it, which
  // is simpler than threading controlled values through every field. Starts at
  // 1 because the keyed Show below treats 0 as nothing to render.
  const [formKey, setFormKey] = createSignal(1);
  const [preset, setPreset] = createSignal<ComparePreset | null>(null);
  const [lastInput, setLastInput] = createSignal<CompareWeekendInput | null>(null);

  const result = createMemo(() => compareMutation.data);
  const columns = createMemo(() => result()?.columns ?? []);

  // "Did you mean" cities, when the server could not resolve one of the names.
  const suggestions = createMemo<CitySuggestion[]>(() =>
    compareMutation.isError ? citySuggestionsFrom(compareMutation.error) : [],
  );

  const runCompare = (input: CompareWeekendInput) => {
    setLastInput(input);
    compareMutation.mutate(input);
  };

  const applyPreset = (next: ComparePreset) => {
    setPreset(next);
    setFormKey((k) => k + 1);
  };

  // A suggestion already carries coordinates, so re-running with it skips
  // resolution altogether rather than guessing at the spelling again.
  const applySuggestion = (suggestion: CitySuggestion) => {
    const previous = lastInput();
    const chosen: CitySelection = {
      name: suggestion.name,
      country: suggestion.country,
      lat: suggestion.lat,
      lon: suggestion.lon,
    };
    applyPreset({
      origin: chosen,
      candidates: (previous?.candidates ?? []).map((name) => ({ name })),
    });
  };

  const saveFromColumn = async (col: CityCompareColumn, dual?: boolean) => {
    setChoosingCity(col.cityName);
    setSaveError(null);
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
    } catch (err) {
      // Without this the rejection was unhandled: the spinner stopped, nothing
      // appeared, and the button looked broken. An entitlement denial opens the
      // upgrade prompt; anything else is said in words, next to the button that
      // was pressed.
      if (!handleEntitlementError(err)) {
        setSaveError(friendlyError(err).message);
      }
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
    setSaveError(null);
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
    } catch (err) {
      if (!handleEntitlementError(err)) {
        setSaveError(friendlyError(err).message);
      }
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

        {/* Keyed, so changing the key remounts the form with its new initial
            values. Solid has no React-style `key`, and the alternative — making
            every field controlled from here — would put the form's state in the
            route just to support prefilling it. */}
        <Show when={formKey()} keyed>
          <CompareForm
            pending={compareMutation.isPending}
            onSubmit={runCompare}
            onUpgrade={() =>
              showUpgradePrompt(
                "entitlement",
                "Compare up to 8 cities and plan a multi-city route with Pro.",
              )
            }
            initialOrigin={preset()?.origin ?? null}
            initialCandidates={preset()?.candidates ?? []}
          />
        </Show>

        {/* The old banner printed the raw ConnectError, so a user saw
            "[invalid_argument] compare: origin city not found: Porto". */}
        <Show when={compareMutation.isError}>
          <div class="mb-6 flex flex-col gap-3">
            <ErrorView
              error={compareMutation.error}
              onRetry={() => {
                const input = lastInput();
                if (input) compareMutation.mutate(input);
              }}
            />
            <Show when={suggestions().length > 0}>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-muted-foreground">Did you mean</span>
                <For each={suggestions()}>
                  {(s) => (
                    <button
                      type="button"
                      class="loci-chip text-sm"
                      onClick={() => applySuggestion(s)}
                    >
                      {s.name}
                      <Show when={s.country}>
                        <span class="text-muted-foreground"> · {s.country}</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={saveError()}>
          <div class="loci-card rounded-2xl p-4 border-destructive/40 text-destructive mb-6">
            {saveError()}
          </div>
        </Show>

        <Show when={compareMutation.isPending}>
          <div class="grid gap-6 md:grid-cols-2">
            <ColumnSkeleton />
            <ColumnSkeleton />
          </div>
        </Show>

        <Show when={!compareMutation.isPending && !result() && !compareMutation.isError}>
          <CompareEmptyState onPick={applyPreset} />
        </Show>

        <Show when={!compareMutation.isPending && result()}>
          {(data) => (
            <>
              <Show when={data().recommendationReason}>
                <div class="flex items-center gap-2 mb-6">
                  <CloudSun class="w-5 h-5 text-primary" />
                  <p class="text-sm text-muted-foreground">{data().recommendationReason}</p>
                  <span class="loci-chip text-xs">
                    {recommendationLabel(data().recommendation, columns())}
                  </span>
                </div>
              </Show>

              {/* Every column being dropped is impossible today — the server
                  fails before it can happen — but a blank page would be the
                  worst way to find out that changed. */}
              <Show
                when={columns().length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    None of those cities could be compared. Try different ones.
                  </p>
                }
              >
                <div class="grid gap-6 md:grid-cols-2">
                  <For each={columns()}>
                    {(col) => (
                      <ColumnCard
                        column={col}
                        choosing={choosingCity() === col.cityName}
                        onChoose={() => saveFromColumn(col)}
                      />
                    )}
                  </For>
                </div>
              </Show>

              <Show when={data().multiCityPlan}>
                <div class="mt-8">
                  <MultiCityPlanCard
                    plan={data().multiCityPlan as MultiCityPlan}
                    saving={choosingCity() === "__route__"}
                    onSave={saveFromPlan}
                  />
                </div>
              </Show>
            </>
          )}
        </Show>
      </div>
    </>
  );
}
