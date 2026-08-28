# Native globe — iOS implementation spec

Companion to `docs/NATIVE_DESIGN.md`. **Specification only — no Swift is written
or shipped as part of this work.** It records what the web globe does, which
parts translate directly to iOS, and the handful of places where the native
platform is genuinely better than the web one.

Reference screenshots for the native side are the "My Plan" set: a liquid-glass
timeline sheet over a satellite map, D-16 / D-22 countdown chips, transport
segments carrying operator logos, a Guide / Plan tab bar, and a sheet that drags
down to reveal the map behind it.

---

## 1. Map engine: MapKit or Mapbox Maps SDK for iOS

**Recommendation: MapKit**, unless the design later demands the exact same
basemap on both platforms.

| | MapKit | Mapbox Maps SDK for iOS |
|---|---|---|
| Cost | Free, generous limits | Billed per monthly active user |
| Binary size | System framework, ~0 added | ~5–10 MB added |
| Geodesic polylines | **`MKGeodesicPolyline`, built in** | Must densify by hand, as the web does |
| Satellite imagery | `.hybrid` / `.hybridFlyover` | Standard Satellite |
| Style parity with web | No | Yes |
| Globe view | `MKMapView` is not a globe; it is a flat/3D map | True globe projection |

The parity question is the real decision, and it is worth being blunt about it:
**iOS cannot reproduce the web "planet in space" framing with MapKit.** MapKit
has no globe projection. If the whole-planet view is the point, that is the one
argument for taking the Mapbox SDK's cost and binary size.

If the native product is really the *itinerary* (which the "My Plan" screenshots
suggest) rather than the *global view*, MapKit is the right call and the globe
stays a web-only surface.

## 2. `MKGeodesicPolyline` — where iOS is simpler than the web

The web implementation hand-rolls a spherical-linear-interpolation great circle
(`src/components/features/Map/geo.ts`, `greatCircle`) with ~1 vertex per 2° of
arc, plus an antimeridian unwrap pass, because Mapbox GL JS interpolates line
vertices in *projected* space — a two-point Lisbon→Tokyo LineString renders as a
straight chord rather than a geodesic.

`MKGeodesicPolyline(coordinates:count:)` does all of that in the framework. It
also handles the antimeridian correctly.

**Do not port `geo.ts` to Swift.** The web's densification and unwrapping exist
to work around a web renderer limitation that does not exist on iOS. Porting it
would be carrying a workaround to a platform that never had the problem.

What *should* be shared is the distance definition: `haversineKm` in `geo.ts` and
`HaversineKm` in `internal/domain/travelhistory` agree, so a leg's label matches
its curve. iOS should use `CLLocation.distance(from:)` and verify it agrees to
within a kilometre, rather than assuming.

## 3. City nodes and labels

The web uses Mapbox symbol layers with a 9-slice stretchable pill image, because
DOM markers only *fade* behind the globe rather than clipping, and 20–60 of them
are a per-frame transform cost.

On iOS:

- `MKAnnotationView` with `clusteringIdentifier` for automatic clustering.
- The pill is a plain `UIView` / SwiftUI label with a capsule background — no
  9-slice canvas trick needed, because iOS annotations are real views.
- `displayPriority` replaces the web's `symbol-sort-key`, so cities with a higher
  visit count win when labels collide.
- `MKMapView` handles occlusion for annotations behind terrain; there is no
  globe far-side to cull because there is no globe.

## 4. The leg scrubber

This is the piece most at risk of being implemented wrongly, so the constraint
is worth restating: **Loci has no vehicle telemetry.** A marker that moves along
a route must not read as a live position.

Carry all three of the web's decisions across:

1. It rests **static at the arc midpoint** and only animates while a leg is
   selected.
2. The motion is **linear**. Easing implies acceleration, implies physics,
   implies a vehicle.
3. The label carries **distance and duration from the real leg row**, never an
   ETA and never "currently at".

Use a **neutral chevron or dot, never a plane glyph.**

Implementation: `CADisplayLink` rather than a `Timer`, so the marker is driven by
the display refresh. Sample by cumulative ground distance, not by vertex index —
`MKGeodesicPolyline` exposes its points via `points()` / `pointCount`, and slerp
output bunches near the endpoints, so index-stepping makes the marker visibly
stall there. This mirrors `cumulativeDistances` / `sampleAlongPath` in `geo.ts`.

Respect `UIAccessibility.isReduceMotionEnabled` exactly as the web respects
`prefers-reduced-motion`: park the marker at the midpoint, do not hide it. Also
observe `UIAccessibility.reduceMotionStatusDidChangeNotification` — unlike the
web hook, which reads once, iOS users can change this while the app is running.

Pause the display link on `scenePhase != .active`.

## 5. SwiftUI layout

| Web element | iOS equivalent |
|---|---|
| Left icon rail (`GlobeRail.tsx`) | `TabView` tab bar — Guide / Plan, per the screenshots |
| Statistics rail (`StatsRail.tsx`) | A `Section` in the sheet's detent, not a fixed side rail |
| Activities drawer (`ActivitiesDrawer.tsx`) | `.presentationDetents([.height(120), .medium, .large])` on a `.sheet` |
| Coordinate readout (`CoordReadout.tsx`) | Monospaced `Text` with `.monospacedDigit()` |
| 3D/2D toggle (`GlobeControls.tsx`) | `Picker(.segmented)` — or omit, if MapKit has no globe to toggle from |
| Mini-map PiP (`MiniMap.tsx`) | Omit. iOS has the whole screen; a locator inside a locator is noise |

The drag-down-to-reveal-map interaction in the screenshots is exactly what
`presentationDetents` provides natively, with `.presentationBackgroundInteraction(.enabled)`
so the map stays pannable while the sheet is open. That last modifier is the
native equivalent of the web's most load-bearing accessibility decision: the web
drawer deliberately uses a **non-modal** Kobalte Accordion rather than a Dialog,
because a focus trap would stop the user panning the globe while reading the
table. Do not use a modal sheet here.

Countdown chips ("D-16") are computed from `TripDay.date`, which is
**optional** — a trip with no dates gets no chip rather than a fabricated one.
This is the same rule the travel-history backfill follows server-side.

## 6. Data

One RPC fills the entire surface: `TravelHistoryService.GetGlobeData`
(`proto/loci/travelhistory/travelhistory.proto`), returning cities, arcs and a
summary together. Use it rather than three calls.

Two fields matter for correctness:

- `TravelSummary.*_prev_period` — these exist so a trend indicator is a **real**
  period-over-period delta. If there is no prior period, render **no** indicator.
  Do not substitute 0% or +100%.
- `GetGlobeDataResponse.backfilled` — distinguishes "you have been nowhere yet"
  from "we have not worked it out yet". These are different empty states and
  should read differently.

`VisitedCity.country` is empty when unresolved and is never inferred from
coordinates. Render "—", not a guess.

## 7. Accessibility

The web surface is held to a Lighthouse accessibility score of 1.0. The native
equivalents:

- Every icon-only control needs an `.accessibilityLabel`. The web pairs each rail
  icon with both an `aria-label` and a visible tooltip for this reason.
- The globe/map itself is `.accessibilityElement(children: .ignore)` with a
  descriptive label; the **list** is the navigable representation, not the map.
  Same split as the web, where the globe is `role="img"` and the drawer table
  carries the real semantics.
- Minimum 44×44pt touch targets, matching the web's 44px rule.
- Support Dynamic Type in the sheet. The web's fixed 11px pill labels do not
  translate — native labels must scale.
