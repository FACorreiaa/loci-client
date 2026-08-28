import { createMemo, lazy, Show } from "solid-js";
import type { GlobeLeg, GlobeNode } from "~/components/features/Map/Globe";
import type { Trip } from "~/lib/api/trips";

// Own lazy entry, so /trips only pays for the globe chunk and not for the POI
// map's clustering and popup code.
const GlobeComponent = lazy(() => import("~/components/features/Map/Globe"));

interface TripGlobeProps {
  trips: Trip[];
  /** Highlighted leg. */
  selectedLegId?: string;
  onSelectNode?: (node: GlobeNode) => void;
  class?: string;
  /** Whole-planet framing, versus fitting to the plotted cities. */
  fitWorld?: boolean;
}

/**
 * Plots trips as cities and great-circle legs.
 *
 * Both come from data the trip already carries: TripDay.cityLat/cityLon for the
 * places, and the TripLeg from/to coordinates for the hops. Nothing is
 * synthesised between cities
 * that merely appear in the same trip — a trip with no recorded legs shows its
 * cities and no arcs, which is the truth about that trip.
 */
export default function TripGlobe(props: TripGlobeProps) {
  const nodes = createMemo<GlobeNode[]>(() => {
    // Merge by name so a city visited on several days is one node with a
    // weight, not several stacked dots.
    const byKey = new Map<string, GlobeNode>();
    for (const trip of props.trips) {
      for (const day of trip.days) {
        const name = day.cityName || trip.cityName;
        if (!name || day.cityLat == null || day.cityLon == null) continue;
        const key = name.trim().toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          existing.weight += 1;
        } else {
          byKey.set(key, {
            id: day.cityId || key,
            label: name,
            lngLat: [day.cityLon, day.cityLat],
            weight: 1,
          });
        }
      }
    }
    return [...byKey.values()];
  });

  const legs = createMemo<GlobeLeg[]>(() => {
    const out: GlobeLeg[] = [];
    for (const trip of props.trips) {
      for (const leg of trip.legs ?? []) {
        // A leg missing any endpoint cannot be drawn honestly — straightening
        // it onto a city centroid would invent a route.
        if (leg.fromLat == null || leg.fromLon == null || leg.toLat == null || leg.toLon == null) {
          continue;
        }
        out.push({
          id: leg.id || `${trip.id}-${leg.afterDay}`,
          fromName: leg.fromName,
          toName: leg.toName,
          from: [leg.fromLon, leg.fromLat],
          to: [leg.toLon, leg.toLat],
          distanceKm: leg.distanceKm,
          durationMins: leg.durationMins,
          mode: leg.mode ?? "",
        });
      }
    }
    return out;
  });

  const hasGeometry = () => nodes().length > 0 || legs().length > 0;

  return (
    <Show
      when={hasGeometry()}
      fallback={
        <div
          class={`grid place-items-center rounded-2xl border border-dashed border-border ${props.class ?? ""}`}
        >
          <p class="px-6 py-10 text-center text-sm text-muted-foreground">
            Your trips don&rsquo;t have city coordinates yet, so there&rsquo;s nothing to plot.
          </p>
        </div>
      }
    >
      <div class={`overflow-hidden rounded-2xl border border-border ${props.class ?? ""}`}>
        <GlobeComponent
          nodes={nodes()}
          legs={legs()}
          selectedLegId={props.selectedLegId}
          onSelectNode={props.onSelectNode}
          fitWorld={props.fitWorld ?? false}
        />
      </div>
    </Show>
  );
}
