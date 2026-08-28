import { createMemo, createSignal, lazy, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import type mapboxgl from "mapbox-gl";
import { useGlobeData } from "~/lib/api/travel-history";
import type { GlobeLeg, GlobeNode } from "~/components/features/Map/Globe";
import GlobeRail from "~/components/features/Globe/GlobeRail";
import StatsRail from "~/components/features/Globe/StatsRail";
import CoordReadout from "~/components/features/Globe/CoordReadout";
import GlobeControls from "~/components/features/Globe/GlobeControls";
import MiniMap from "~/components/features/Globe/MiniMap";
import ActivitiesDrawer from "~/components/features/Globe/ActivitiesDrawer";

// Lazy + a data-gated <Show>, the established pattern at all 11 map call sites.
// The Show is false during SSR because the query is skipped on the server, which
// is what keeps mapbox-gl out of the server bundle.
const GlobeComponent = lazy(() => import("~/components/features/Map/Globe"));

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 16;

export default function GlobePage() {
  const globeData = useGlobeData();
  const [projection, setProjection] = createSignal<"globe" | "mercator">("globe");
  const [centre, setCentre] = createSignal({ lng: 10, lat: 25 });
  const [settled, setSettled] = createSignal<{ lng: number; lat: number }>();
  const [zoom, setZoom] = createSignal(1.4);
  const [selectedLegId, setSelectedLegId] = createSignal<string>();
  const [map, setMap] = createSignal<mapboxgl.Map>();

  const cities = () => globeData.data?.cities ?? [];
  const arcs = () => globeData.data?.arcs ?? [];

  const nodes = createMemo<GlobeNode[]>(() =>
    cities().map((c) => ({
      id: c.id,
      label: c.cityName,
      lngLat: [c.longitude, c.latitude],
      weight: c.visitCount,
    })),
  );

  // Leg ids are positional because a GlobeArc has no id of its own; the drawer
  // derives the same key so selection stays in sync between the two.
  const legs = createMemo<GlobeLeg[]>(() =>
    arcs().map((a, i) => ({
      id: `${a.tripId ?? "leg"}-${i}`,
      fromName: a.fromName,
      toName: a.toName,
      from: [a.fromLon, a.fromLat] as [number, number],
      to: [a.toLon, a.toLat] as [number, number],
      distanceKm: a.distanceKm,
      mode: a.mode,
    })),
  );

  const hasData = () => nodes().length > 0 || legs().length > 0;

  const onReady = (m: mapboxgl.Map) => {
    setMap(m);
    m.on("moveend", () => {
      const c = m.getCenter();
      setSettled({ lng: c.lng, lat: c.lat });
    });
  };

  return (
    <>
      <Title>Global view · Loci</Title>

      {/* The chromeless route renders no Nav, so the page owns its own heading
          and skip target. Visually hidden, still first in the a11y tree. */}
      <h1 class="sr-only">Global view of the places you have visited</h1>

      <div class="relative h-full w-full overflow-hidden bg-background">
        <Show
          when={hasData()}
          fallback={
            <div class="flex h-full w-full items-center justify-center px-6">
              <div class="max-w-md text-center">
                <Show
                  when={!globeData.isLoading}
                  fallback={<p class="text-sm text-muted-foreground">Loading your travels…</p>}
                >
                  <Show
                    when={globeData.data?.backfilled}
                    fallback={
                      <p class="text-sm text-muted-foreground">
                        We haven&rsquo;t worked out your travel history yet. Check back shortly.
                      </p>
                    }
                  >
                    <h2 class="font-serif text-2xl">No travels recorded yet</h2>
                    <p class="mt-2 text-sm text-muted-foreground">
                      Cities appear here once a trip has real dates in the past, or once you mark a
                      stop as visited. We don&rsquo;t guess from plans.
                    </p>
                  </Show>
                </Show>
              </div>
            </div>
          }
        >
          <div class="absolute inset-0">
            <GlobeComponent
              nodes={nodes()}
              legs={legs()}
              projection={projection()}
              selectedLegId={selectedLegId()}
              onMove={(c, z) => {
                setCentre(c);
                setZoom(z);
              }}
              onReady={onReady}
            />
          </div>
        </Show>

        <GlobeRail />

        {/* Hero copy */}
        <div class="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 lg:block xl:left-24">
          <p class="ui-label text-xs text-muted-foreground">Your travels</p>
          <p class="mt-2 max-w-xs font-serif text-4xl leading-tight">
            Everywhere
            <br />
            you&rsquo;ve been
          </p>
        </div>

        {/* Statistics rail */}
        <div class="absolute right-6 top-24 hidden w-56 lg:block xl:right-24">
          <StatsRail summary={globeData.data?.summary} loading={globeData.isLoading} />
        </div>

        {/* Coordinate readout */}
        <div class="absolute bottom-24 left-6 hidden md:block">
          <CoordReadout lat={centre().lat} lng={centre().lng} settled={settled()} />
        </div>

        {/* Projection + zoom */}
        <div class="absolute bottom-24 left-1/2 -translate-x-1/2">
          <GlobeControls
            projection={projection()}
            onProjection={setProjection}
            canZoomIn={zoom() < MAX_ZOOM}
            canZoomOut={zoom() > MIN_ZOOM}
            onZoomIn={() => map()?.zoomIn({ duration: 300 })}
            onZoomOut={() => map()?.zoomOut({ duration: 300 })}
          />
        </div>

        {/* Locator */}
        <div class="absolute bottom-24 right-6 hidden md:block">
          <MiniMap
            lng={centre().lng}
            lat={centre().lat}
            nodes={nodes().map((n) => ({ id: n.id, lngLat: n.lngLat }))}
            onJump={(lng, lat) => map()?.flyTo({ center: [lng, lat], duration: 900 })}
          />
        </div>

        <ActivitiesDrawer
          cities={cities()}
          arcs={arcs()}
          selectedLegId={selectedLegId()}
          onSelectLeg={setSelectedLegId}
        />
      </div>
    </>
  );
}
