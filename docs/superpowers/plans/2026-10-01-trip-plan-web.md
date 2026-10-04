# Trip plan on the web (Plan panel + chat proposal cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the web, a traveller can plan a trip from both directions:
- **By hand, in a Plan panel on the trip page:** set dates, pick a hotel per city by stars, and build and save flight searches.
- **From chat, opened from that trip:** the agent's proposals appear as cards the traveller confirms or dismisses.

**Architecture:**
- **Trip model.** `Trip` gains `startDate`, `endDate`, `stays` and `flights`, mapped from proto v5.35+. Five `detailMutation` hooks call the new TripService RPCs.
- **`TripPlanPanel` on `/trips/[id]`.** It takes an injectable `PlanApi`, like `WatchProposalCard` takes `WatchApi`:
  - hotels come from the existing `FavoritesService.GetNearbyHotels`, star-filtered in the browser, at the city's coordinates from `TripDay.cityLat/cityLon`;
  - flight links come from `BuildFlightLinks`.
- **Chat.** `/chat?trip=<id>` binds the chat to a trip:
  - `ChatStreamParams.tripId` goes on every stream;
  - an `action_proposal` stream event becomes a `"trip-action"` chat message rendered by `TripActionCard`;
  - confirming calls `ApplyTripAction` with the trip's current version and writes the returned trip into the query cache.

**Tech Stack:** SolidJS / SolidStart v2, TanStack solid-query, connect-web, protobuf-es from the BSR package `@buf/loci_loci-proto.bufbuild_es`, Tailwind v4 with shadcn-style `~/ui/*`, vitest with happy-dom.

**Spec:** `loci-connect-server/docs/superpowers/specs/2026-09-30-trip-workflow-agent-actions-design.md`, sections Surfaces / Web. This is plan 3 of 5. The server parts are plans 1 and 2, both live.

## Global Constraints

- **Proto:** use `pnpm buf-update`, never `pnpm add …@latest`. Add `"loci/chat"` to `REQUIRED` in `scripts/buf-update.mjs`. The pin must contain `ActionProposal` (v5.35.0+).
- **Formatting:** never run repo-wide `pnpm format`; HEAD isn't oxfmt-clean. Format touched files only, with `pnpm exec oxfmt <paths>`.
- **Shared checkout:** another session commits in the loci-client checkout. Work in the worktree `/private/tmp/web-trip-plan` and `git add` explicit paths.
- **Optional string fields:** omit them with `|| undefined`, never send `""`. Many have `min_len` validators.
- **Version conflicts:** every trip write passes the version it was shown against. On `FailedPrecondition`, refetch the trip and say "This trip changed elsewhere", as `[id].tsx` already does through `onMutationError`.
- **Prices:** Loci never shows a price it didn't get from the traveller. Flight cards show links, not fares.
- **Styling:** reuse the existing classes: `loci-card`, the `font-coord` section labels, `~/ui/button`, and for chat cards the `--muse-*` tokens.
- **After merge, check the live bundle:**
  - Production deploys race between Workers Builds and the Actions deploy.
  - Grep the live bundle for `api.lociai.fyi` and for `ApplyTripAction`.
  - If it's missing, re-dispatch the Actions deploy.

## Review Focus

1. **Dates edited somewhere else** (iOS, or the calendar's Pin dates) while the panel is open: saving gives a conflict notice and a refetch, never a silent overwrite. Pinned in Task 4.
2. **A trip whose days have no coordinates:** the stay section says hotels can't be searched for that city instead of searching at 0,0. Pinned in Tasks 3 and 4.
3. **A proposal card confirmed after the trip changed:** "This trip changed since the suggestion; ask again", and the card stays. Pinned in Task 6.
4. **`/chat` opened without `?trip`:** it behaves exactly as before. No `tripId` is sent and no cards appear. Pinned in Task 5.
5. **A hotel pick** (`option_index`) is required, and a flight card confirms with option 0. Pinned in Task 6.

## File map

**New files:**
- `src/lib/api/trip-plan.ts`: the plan RPCs, star filter and city coordinates
- `src/lib/api/trip-actions.ts`: Apply/Dismiss
- `src/components/trip/TripPlanPanel.tsx`
- `src/components/chat/TripActionCard.tsx`

**Modified files:**
- `scripts/buf-update.mjs`, `package.json`, `pnpm-lock.yaml`
- `src/lib/api/trips.ts`: the Trip model
- `src/lib/streaming/chatStream.ts`: the event and `tripId`
- `src/lib/hooks/useChat.ts`
- `src/routes/chat/index.tsx`
- `src/routes/trips/[id].tsx`
- `src/components/trip/TripHero.tsx`

**Tests:**
- `src/lib/api/trip-plan.test.ts`
- `src/lib/streaming/chatStream.test.ts` (append)
- `src/components/trip/TripPlanPanel.test.ts`
- `src/components/chat/TripActionCard.test.ts`

---

### Task 1: Proto bump

- [ ] **Step 1:** In `scripts/buf-update.mjs`, change `REQUIRED` to include `"loci/chat"`:

```js
const REQUIRED = ["loci/memory", "loci/apikey", "loci/trip", "loci/auth", "loci/calendar", "loci/gastronomy", "loci/chat"];
```

- [ ] **Step 2:** Run `pnpm install --frozen-lockfile=false && pnpm buf-update`.
Expected: `package.json` pins a version dated 2026-10-01 at 12:20 UTC or later. Then confirm the types exist:

```bash
grep -c ActionProposal node_modules/@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.d.ts
grep -c SetTripDatesRequest node_modules/@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.d.ts
```

Expected: both counts are non-zero.

- [ ] **Step 3:** Run `pnpm typecheck && pnpm test`.
Expected: everything passes. A new proto version adds fields only.

- [ ] **Step 4:** Commit: `git add scripts/buf-update.mjs package.json pnpm-lock.yaml && git commit -m "chore(deps): loci-proto with trip plans and chat trip actions"`

---

### Task 2: Trip model and plan RPC hooks

**Files:**
- Modify `src/lib/api/trips.ts`.
- Create `src/lib/api/trip-plan.ts` and `src/lib/api/trip-plan.test.ts`.

**Interfaces:**
- Produces:
  - Types `TripStay { cityName; poiId?; name; starRating?; checkIn?; checkOut?; bookingUrl? }`, `FlightPlace { name; iata? }`, `FlightLink { provider; label; url }` and `TripFlight { id; origin; destination; departDate; returnDate?; passengers; cabin: FlightCabinName; links; carrier?; flightNo?; priceText?; notes? }`, all exported from `trips.ts`.
  - `Trip` gains `startDate?`, `endDate?` (YYYY-MM-DD), `stays: TripStay[]` and `flights: TripFlight[]`.
  - `type FlightCabinName = "economy" | "premium_economy" | "business" | "first" | undefined`.
  - `interface PlanApi { setDates; setStay; clearStay; addFlight; removeFlight; buildLinks }` (signatures below) and `planApi`.
  - Hooks `useSetTripDates()`, `useSetStay()`, `useClearStay()`, `useAddFlight()` and `useRemoveFlight()`, each a `detailMutation`.

- [ ] **Step 1: Failing test** (`src/lib/api/trip-plan.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import {
  FlightCabin,
  TripDraftSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { mapTrip } from "./trips";
import { cityCoords, cabinFromName, hotelsWithStars, starsOf } from "./trip-plan";

describe("mapTrip plan fields", () => {
  it("maps dates, stays and flights", () => {
    const t = mapTrip(
      create(TripDraftSchema, {
        id: "t1", title: "Lisbon", cityName: "Lisbon", version: 3n,
        startDate: "2026-11-12", endDate: "2026-11-15",
        stays: [{ cityName: "Lisbon", name: "Hotel Avenida", starRating: "4", bookingUrl: "https://a.example" }],
        flights: [{
          id: "f1", origin: { name: "New York", iata: "JFK" }, destination: { name: "Lisbon" },
          departDate: "2026-11-12", passengers: 2, cabin: FlightCabin.BUSINESS,
          links: [{ provider: "google_flights", label: "Google Flights", url: "https://g.example" }],
        }],
      }),
    );
    expect(t.startDate).toBe("2026-11-12");
    expect(t.endDate).toBe("2026-11-15");
    expect(t.stays[0]).toMatchObject({ cityName: "Lisbon", name: "Hotel Avenida", starRating: "4" });
    expect(t.flights[0]).toMatchObject({
      id: "f1", origin: { name: "New York", iata: "JFK" }, destination: { name: "Lisbon" },
      passengers: 2, cabin: "business",
    });
    expect(t.flights[0].destination.iata).toBeUndefined();
    expect(t.flights[0].links[0].url).toBe("https://g.example");
  });

  it("an older trip has empty plan fields", () => {
    const t = mapTrip(create(TripDraftSchema, { id: "t1", title: "x", version: 1n }));
    expect(t.startDate).toBeUndefined();
    expect(t.stays).toEqual([]);
    expect(t.flights).toEqual([]);
  });
});

describe("stars", () => {
  it("reads numbers before glyphs", () => {
    expect(starsOf("4")).toBe(4);
    expect(starsOf("4.5")).toBe(4.5);
    expect(starsOf("4★")).toBe(4);
    expect(starsOf("★★★")).toBe(3);
    expect(starsOf("")).toBeUndefined();
    expect(starsOf(undefined)).toBeUndefined();
  });

  it("filters to the whole-star band; any keeps unrated", () => {
    const hotels = [
      { name: "A", star_rating: 5, rating: 4.8 },
      { name: "B", star_rating: 4.5, rating: 4.2 },
      { name: "C", star_rating: undefined, rating: 4.9 },
      { name: "D", star_rating: 3, rating: 4.0 },
    ] as any[];
    expect(hotelsWithStars(hotels, 4).map((h) => h.name)).toEqual(["B"]);
    expect(hotelsWithStars(hotels, 0).map((h) => h.name)).toEqual(["C", "A", "B", "D"]);
  });
});

describe("cityCoords", () => {
  it("takes the first day in that city that has coordinates", () => {
    const trip = { cityName: "Lisbon", days: [
      { cityName: "Lisbon" }, { cityName: "Porto", cityLat: 41.1, cityLon: -8.6 }, { cityName: "", cityLat: 38.7, cityLon: -9.1 },
    ] } as any;
    expect(cityCoords(trip, "Porto")).toEqual({ lat: 41.1, lon: -8.6 });
    expect(cityCoords(trip, "lisbon")).toEqual({ lat: 38.7, lon: -9.1 }); // empty day city = primary city
    expect(cityCoords(trip, "Faro")).toBeUndefined();
  });
});

describe("cabin", () => {
  it("round-trips names", () => {
    expect(cabinFromName("business")).toBe(FlightCabin.BUSINESS);
    expect(cabinFromName(undefined)).toBe(FlightCabin.UNSPECIFIED);
  });
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run src/lib/api/trip-plan.test.ts`.
Expected: FAIL, because `./trip-plan` doesn't exist and `t.startDate` is undefined.

- [ ] **Step 3: Implement.** In `trips.ts`, add the types next to `TripLeg`:

```ts
export type FlightCabinName = "economy" | "premium_economy" | "business" | "first";

/** Where the traveller sleeps in one city (TripService.SetStay). */
export interface TripStay {
  cityName: string;
  poiId?: string;
  name: string;
  starRating?: string;
  checkIn?: string;
  checkOut?: string;
  bookingUrl?: string;
}

export interface FlightPlace {
  name: string;
  iata?: string;
}

/** A prefilled search on a site that sells the ticket. Server-built. */
export interface FlightLink {
  provider: string;
  label: string;
  url: string;
}

/** A flight the traveller chose. Loci never quotes a fare. */
export interface TripFlight {
  id: string;
  origin: FlightPlace;
  destination: FlightPlace;
  departDate: string;
  returnDate?: string;
  passengers: number;
  cabin?: FlightCabinName;
  links: FlightLink[];
  carrier?: string;
  flightNo?: string;
  priceText?: string;
  notes?: string;
}
```

Add to `interface Trip` after `copiedFromTripId?: string;`:

```ts
  /** The trip's plan (dates, stays, flights). SaveTrip never writes these. */
  startDate?: string;
  endDate?: string;
  stays: TripStay[];
  flights: TripFlight[];
```

In `mapTrip`, after `copiedFromTripId: …`:

```ts
  startDate: p.startDate || undefined,
  endDate: p.endDate || undefined,
  stays: (p.stays ?? []).map(mapStay),
  flights: (p.flights ?? []).map(mapFlight),
```

Then add these, exported, above `mapTrip`:

```ts
const CABIN_NAMES: Record<number, FlightCabinName | undefined> = {
  [FlightCabin.ECONOMY]: "economy",
  [FlightCabin.PREMIUM_ECONOMY]: "premium_economy",
  [FlightCabin.BUSINESS]: "business",
  [FlightCabin.FIRST]: "first",
};

export const mapStay = (s: ProtoTripStay): TripStay => ({
  cityName: s.cityName,
  poiId: s.poiId || undefined,
  name: s.name,
  starRating: s.starRating || undefined,
  checkIn: s.checkIn || undefined,
  checkOut: s.checkOut || undefined,
  bookingUrl: s.bookingUrl || undefined,
});

export const mapFlight = (f: ProtoTripFlight): TripFlight => ({
  id: f.id,
  origin: { name: f.origin?.name ?? "", iata: f.origin?.iata || undefined },
  destination: { name: f.destination?.name ?? "", iata: f.destination?.iata || undefined },
  departDate: f.departDate,
  returnDate: f.returnDate || undefined,
  passengers: f.passengers,
  cabin: CABIN_NAMES[f.cabin],
  links: f.links.map((l) => ({ provider: l.provider, label: l.label, url: l.url })),
  carrier: f.carrier || undefined,
  flightNo: f.flightNo || undefined,
  priceText: f.priceText || undefined,
  notes: f.notes || undefined,
});
```

Add `FlightCabin`, `type TripStay as ProtoTripStay` and `type TripFlight as ProtoTripFlight` to the existing `trip_pb.js` import. Every other place that builds a `Trip` literal must now set `stays: [], flights: []`. Find them with `pnpm typecheck`, which names each one, and fix them in this task.

Create `src/lib/api/trip-plan.ts`:

```ts
// A trip's plan — dates, a stay per city, flights — written through the
// dedicated TripService RPCs (SaveTrip never touches them), plus the helpers
// the Plan panel needs: hotels near a city filtered by stars, and where a
// city of the trip is.
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import {
  AddFlightRequestSchema,
  BuildFlightLinksRequestSchema,
  ClearStayRequestSchema,
  FlightCabin,
  RemoveFlightRequestSchema,
  SetStayRequestSchema,
  SetTripDatesRequestSchema,
  TripService,
  type TripDraft as ProtoTripDraft,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  FavoritesService,
  GetNearbyHotelsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { mapProtoToHotel } from "./hotels";
import type { HotelDetailedInfo } from "./shared";
import type { FlightCabinName, FlightLink, FlightPlace, Trip, TripStay } from "./trips";

const tripClient = createClient(TripService, transport);
const favoritesClient = createClient(FavoritesService, transport);

export interface FlightSearch {
  origin: FlightPlace;
  destination: FlightPlace;
  departDate: string;
  returnDate?: string;
  passengers: number;
  cabin?: FlightCabinName;
}

export const cabinFromName = (name: FlightCabinName | undefined): FlightCabin => {
  switch (name) {
    case "economy": return FlightCabin.ECONOMY;
    case "premium_economy": return FlightCabin.PREMIUM_ECONOMY;
    case "business": return FlightCabin.BUSINESS;
    case "first": return FlightCabin.FIRST;
    default: return FlightCabin.UNSPECIFIED;
  }
};

const place = (p: FlightPlace) => ({ name: p.name.trim(), iata: p.iata?.trim().toUpperCase() || undefined });

/** The plan calls the panel makes. Components take this so tests can fake it. */
export interface PlanApi {
  setDates(tripId: string, start: string, end: string, baseVersion: bigint): Promise<ProtoTripDraft>;
  setStay(tripId: string, stay: TripStay, baseVersion: bigint): Promise<ProtoTripDraft>;
  clearStay(tripId: string, cityName: string, baseVersion: bigint): Promise<ProtoTripDraft>;
  addFlight(tripId: string, f: FlightSearch & { notes?: string }, baseVersion: bigint): Promise<ProtoTripDraft>;
  removeFlight(tripId: string, flightId: string, baseVersion: bigint): Promise<ProtoTripDraft>;
  buildLinks(f: FlightSearch): Promise<FlightLink[]>;
  hotelsNear(lat: number, lon: number): Promise<HotelDetailedInfo[]>;
}

export const planApi: PlanApi = {
  setDates: (tripId, startDate, endDate, baseVersion) =>
    tripClient.setTripDates(create(SetTripDatesRequestSchema, { tripId, startDate, endDate, baseVersion })),
  setStay: (tripId, s, baseVersion) =>
    tripClient.setStay(
      create(SetStayRequestSchema, {
        tripId,
        baseVersion,
        stay: {
          cityName: s.cityName,
          poiId: s.poiId ?? "",
          name: s.name,
          starRating: s.starRating ?? "",
          checkIn: s.checkIn || undefined,
          checkOut: s.checkOut || undefined,
          bookingUrl: s.bookingUrl?.startsWith("https://") ? s.bookingUrl : undefined,
        },
      }),
    ),
  clearStay: (tripId, cityName, baseVersion) =>
    tripClient.clearStay(create(ClearStayRequestSchema, { tripId, cityName, baseVersion })),
  addFlight: (tripId, f, baseVersion) =>
    tripClient.addFlight(
      create(AddFlightRequestSchema, {
        tripId,
        baseVersion,
        flight: {
          origin: place(f.origin),
          destination: place(f.destination),
          departDate: f.departDate,
          returnDate: f.returnDate || undefined,
          passengers: f.passengers,
          cabin: cabinFromName(f.cabin),
          notes: f.notes || undefined,
        },
      }),
    ),
  removeFlight: (tripId, flightId, baseVersion) =>
    tripClient.removeFlight(create(RemoveFlightRequestSchema, { tripId, flightId, baseVersion })),
  async buildLinks(f) {
    const res = await tripClient.buildFlightLinks(
      create(BuildFlightLinksRequestSchema, {
        origin: place(f.origin),
        destination: place(f.destination),
        departDate: f.departDate,
        returnDate: f.returnDate || undefined,
        passengers: f.passengers,
        cabin: cabinFromName(f.cabin),
      }),
    );
    return res.links.map((l) => ({ provider: l.provider, label: l.label, url: l.url }));
  },
  async hotelsNear(latitude, longitude) {
    const res = await favoritesClient.getNearbyHotels(
      create(GetNearbyHotelsRequestSchema, { latitude, longitude, radiusKm: 5, limit: 40 }),
    );
    return (res.hotels ?? []).map(mapProtoToHotel);
  },
};

/** A hotel's stars as a number: "4", "4.5", "4★", "★★★★". A number wins. */
export const starsOf = (s: string | number | undefined): number | undefined => {
  if (typeof s === "number") return s > 0 && s <= 5 ? s : undefined;
  if (!s) return undefined;
  const m = s.trim().match(/^\d+(\.\d+)?/);
  if (m) {
    const v = parseFloat(m[0]);
    return v > 0 && v <= 5 ? v : undefined;
  }
  const glyphs = (s.match(/★/g) ?? []).length;
  return glyphs > 0 && glyphs <= 5 ? glyphs : undefined;
};

/**
 * Hotels whose whole stars equal `stars`, best rated first. 0 means any star
 * rating, and keeps unrated hotels; a chosen rating drops them, since nobody
 * asking for four stars wants a guess.
 */
export const hotelsWithStars = (hotels: HotelDetailedInfo[], stars: number): HotelDetailedInfo[] =>
  hotels
    .filter((h) => {
      if (stars === 0) return true;
      const v = starsOf(h.star_rating);
      return v !== undefined && Math.floor(v) === stars;
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

/** Where a city of the trip is, from the first day spent there. */
export const cityCoords = (
  trip: Pick<Trip, "cityName" | "days">,
  city: string,
): { lat: number; lon: number } | undefined => {
  const want = city.trim().toLowerCase();
  const isPrimary = trip.cityName.trim().toLowerCase() === want;
  const day = trip.days.find((d) => {
    const name = (d.cityName ?? "").trim().toLowerCase();
    return (name === want || (name === "" && isPrimary)) && d.cityLat != null && d.cityLon != null;
  });
  return day ? { lat: day.cityLat!, lon: day.cityLon! } : undefined;
};

/** The cities a stay can be set for: a multi-city trip's, else the trip's own. */
export const tripCities = (trip: Pick<Trip, "cityName" | "cities">): string[] =>
  trip.cities?.length ? trip.cities.map((c) => c.cityName) : trip.cityName ? [trip.cityName] : [];
```

Also add to `trips.ts`, after `useReplaceStop`, the five hooks built on `detailMutation` and `planApi`:

```ts
export const useSetTripDates = () =>
  detailMutation((i: { tripId: string; start: string; end: string; baseVersion: bigint }) =>
    planApi.setDates(i.tripId, i.start, i.end, i.baseVersion));
export const useSetStay = () =>
  detailMutation((i: { tripId: string; stay: TripStay; baseVersion: bigint }) =>
    planApi.setStay(i.tripId, i.stay, i.baseVersion));
export const useClearStay = () =>
  detailMutation((i: { tripId: string; cityName: string; baseVersion: bigint }) =>
    planApi.clearStay(i.tripId, i.cityName, i.baseVersion));
export const useAddFlight = () =>
  detailMutation((i: { tripId: string; flight: FlightSearch; baseVersion: bigint }) =>
    planApi.addFlight(i.tripId, i.flight, i.baseVersion));
export const useRemoveFlight = () =>
  detailMutation((i: { tripId: string; flightId: string; baseVersion: bigint }) =>
    planApi.removeFlight(i.tripId, i.flightId, i.baseVersion));
```

Add `import { planApi, type FlightSearch } from "./trip-plan";` to `trips.ts`. `trip-plan.ts` imports only types from `trips.ts`, so there is no runtime cycle.

Check the favorites import path with `ls node_modules/@buf/loci_loci-proto.bufbuild_es/loci/favorites/`. If it isn't `v1/favorites_pb.js`, use what `src/lib/api/hotels.ts` imports.

- [ ] **Step 4:** Run `pnpm exec vitest run src/lib/api/trip-plan.test.ts && pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5:** Format and commit:

```bash
pnpm exec oxfmt src/lib/api/trips.ts src/lib/api/trip-plan.ts src/lib/api/trip-plan.test.ts
git add src/lib/api/trips.ts src/lib/api/trip-plan.ts src/lib/api/trip-plan.test.ts <any files typecheck made you touch>
git commit -m "feat(trips): dates, stays and flights on the trip model, and plan RPC hooks"
```

---

### Task 3: TripPlanPanel

**Files:**
- Create `src/components/trip/TripPlanPanel.tsx`.
- Test in `src/components/trip/TripPlanPanel.test.ts`.

**Interfaces:**
- Consumes `PlanApi`, `planApi`, `hotelsWithStars`, `cityCoords`, `tripCities` and `mapTrip`.
- Produces a default export `TripPlanPanel(props: { trip: Trip; onUpdated: (t: Trip) => void; onConflict: () => void; api?: PlanApi })`.
  - It calls the API directly, not the hooks, so tests can inject a fake, as `WatchProposalCard` does.
  - `onUpdated` receives the mapped trip, and the page writes it to the query cache.

- [ ] **Step 1: Failing test**

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import TripPlanPanel from "./TripPlanPanel";
import type { PlanApi } from "~/lib/api/trip-plan";
import type { Trip } from "~/lib/api/trips";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.innerHTML = ""; });

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1", userId: "u", cityName: "Lisbon", title: "Lisbon", version: 3n,
  constraints: { pace: 0 as any, interests: [] }, createdAt: "", updatedAt: "",
  days: [{ id: "d1", dayNumber: 1, stops: [], cityLat: 38.72, cityLon: -9.14 }],
  stays: [], flights: [], ...over,
});

const fakeApi = (over: Partial<PlanApi> = {}): PlanApi => ({
  setDates: vi.fn(async () => create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n, startDate: "2026-11-12", endDate: "2026-11-15" })),
  setStay: vi.fn(async () => create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n })),
  clearStay: vi.fn(), addFlight: vi.fn(async () => create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n })),
  removeFlight: vi.fn(),
  buildLinks: vi.fn(async () => [{ provider: "google_flights", label: "Google Flights", url: "https://g.example" }]),
  hotelsNear: vi.fn(async () => [
    { id: "h1", name: "Hotel Avenida", star_rating: 4, rating: 4.2, website: "https://a.example" },
    { id: "h2", name: "Palace", star_rating: 5, rating: 4.8 },
  ] as any),
  ...over,
});

const mount = (props: Parameters<typeof TripPlanPanel>[0]) => {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => createComponent(TripPlanPanel, props), host);
  return host;
};

const input = (host: HTMLElement, testid: string, value: string) => {
  const el = host.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const click = (host: HTMLElement, testid: string) =>
  (host.querySelector(`[data-testid="${testid}"]`) as HTMLElement).click();

describe("TripPlanPanel", () => {
  it("saves dates with the version it was shown", async () => {
    const api = fakeApi();
    const onUpdated = vi.fn();
    const host = mount({ trip: trip(), onUpdated, onConflict: vi.fn(), api });
    input(host, "plan-start", "2026-11-12");
    input(host, "plan-end", "2026-11-15");
    click(host, "plan-save-dates");
    await flush();
    expect(api.setDates).toHaveBeenCalledWith("t1", "2026-11-12", "2026-11-15", 3n);
    expect(onUpdated.mock.calls[0][0].startDate).toBe("2026-11-12");
  });

  it("a stale version is a conflict, not an error", async () => {
    const api = fakeApi({ setDates: vi.fn(async () => { throw new ConnectError("trip version conflict", Code.FailedPrecondition); }) });
    const onConflict = vi.fn();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict, api });
    input(host, "plan-start", "2026-11-12");
    input(host, "plan-end", "2026-11-15");
    click(host, "plan-save-dates");
    await flush();
    expect(onConflict).toHaveBeenCalled();
  });

  it("finds 4-star hotels near the city and saves the pick", async () => {
    const api = fakeApi();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    (host.querySelector('[data-testid="plan-stars-Lisbon"]') as HTMLSelectElement).value = "4";
    host.querySelector('[data-testid="plan-stars-Lisbon"]')!.dispatchEvent(new Event("change", { bubbles: true }));
    click(host, "plan-find-Lisbon");
    await flush();
    expect(api.hotelsNear).toHaveBeenCalledWith(38.72, -9.14);
    const picks = host.querySelectorAll('[data-testid="plan-hotel"]');
    expect(picks).toHaveLength(1);
    (picks[0] as HTMLElement).click();
    await flush();
    expect(api.setStay).toHaveBeenCalledWith(
      "t1", expect.objectContaining({ cityName: "Lisbon", name: "Hotel Avenida", starRating: "4", poiId: "h1" }), 3n);
  });

  it("a city with no coordinates says so instead of searching", () => {
    const api = fakeApi();
    const host = mount({ trip: trip({ days: [{ id: "d1", dayNumber: 1, stops: [] }] }), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    expect(host.querySelector('[data-testid="plan-find-Lisbon"]')).toBeNull();
    expect(host.textContent).toContain("can't search hotels");
  });

  it("builds flight links, then saves the flight", async () => {
    const api = fakeApi();
    const host = mount({ trip: trip(), onUpdated: vi.fn(), onConflict: vi.fn(), api });
    input(host, "plan-from", "New York");
    input(host, "plan-to", "Lisbon");
    input(host, "plan-depart", "2026-11-12");
    click(host, "plan-links");
    await flush();
    expect(host.querySelector('a[href="https://g.example"]')).not.toBeNull();
    click(host, "plan-save-flight");
    await flush();
    expect(api.addFlight).toHaveBeenCalledWith(
      "t1", expect.objectContaining({ origin: { name: "New York" }, destination: { name: "Lisbon" }, departDate: "2026-11-12", passengers: 1 }), 3n);
  });
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run src/components/trip/TripPlanPanel.test.ts`.
Expected: FAIL (no module).

- [ ] **Step 3: Implement** `src/components/trip/TripPlanPanel.tsx`:

```tsx
import { For, Show, createSignal, type Component } from "solid-js";
import { Code, ConnectError } from "@connectrpc/connect";
import { Button } from "~/ui/button";
import { mapTrip, type FlightCabinName, type FlightLink, type Trip } from "~/lib/api/trips";
import {
  cityCoords,
  hotelsWithStars,
  planApi,
  tripCities,
  type FlightSearch,
  type PlanApi,
} from "~/lib/api/trip-plan";
import type { HotelDetailedInfo } from "~/lib/api/shared";

export interface TripPlanPanelProps {
  trip: Trip;
  /** The trip as the server now has it (new version); the page caches it. */
  onUpdated: (trip: Trip) => void;
  /** The trip changed elsewhere; the page refetches and says so. */
  onConflict: () => void;
  /** Injected in tests. */
  api?: PlanApi;
}

const label = "font-coord text-[11px] uppercase tracking-[0.16em] text-muted-foreground";
const field = "rounded-md border border-input bg-background px-2 py-1 text-sm";

/**
 * The trip's plan: dates, where it sleeps in each city, and flights. Each
 * write goes through its own TripService RPC with the version the panel was
 * shown, so an edit made elsewhere is a conflict, never an overwrite.
 */
const TripPlanPanel: Component<TripPlanPanelProps> = (props) => {
  const api = () => props.api ?? planApi;
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  const run = async (fn: () => Promise<Parameters<typeof mapTrip>[0]>) => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      props.onUpdated(mapTrip(await fn()));
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.FailedPrecondition) props.onConflict();
      else setError(err instanceof ConnectError ? err.rawMessage : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Dates
  const [start, setStart] = createSignal(props.trip.startDate ?? "");
  const [end, setEnd] = createSignal(props.trip.endDate ?? "");
  const saveDates = () =>
    run(() => api().setDates(props.trip.id, start(), end(), props.trip.version));

  // Stays
  const [stars, setStars] = createSignal<Record<string, number>>({});
  const [found, setFound] = createSignal<Record<string, HotelDetailedInfo[]>>({});
  const stayFor = (city: string) =>
    props.trip.stays.find((s) => s.cityName.toLowerCase() === city.toLowerCase());
  const findHotels = async (city: string) => {
    const at = cityCoords(props.trip, city);
    if (!at) return;
    setError(null);
    try {
      const hotels = await api().hotelsNear(at.lat, at.lon);
      setFound({ ...found(), [city]: hotelsWithStars(hotels, stars()[city] ?? 0).slice(0, 5) });
    } catch {
      setError(`Couldn't look up hotels in ${city} right now.`);
    }
  };
  const pickHotel = (city: string, h: HotelDetailedInfo) =>
    run(() =>
      api().setStay(
        props.trip.id,
        {
          cityName: city,
          poiId: h.id || undefined,
          name: h.name,
          starRating: h.star_rating ? String(h.star_rating) : undefined,
          bookingUrl: h.website?.startsWith("https://") ? h.website : undefined,
        },
        props.trip.version,
      ),
    ).then(() => setFound({ ...found(), [city]: [] }));

  // Flights
  const [from, setFrom] = createSignal("");
  const [to, setTo] = createSignal(tripCities(props.trip)[0] ?? "");
  const [depart, setDepart] = createSignal(props.trip.startDate ?? "");
  const [ret, setRet] = createSignal(props.trip.endDate ?? "");
  const [pax, setPax] = createSignal(1);
  const [cabin, setCabin] = createSignal<FlightCabinName | "">("");
  const [links, setLinks] = createSignal<FlightLink[]>([]);
  const search = (): FlightSearch => ({
    origin: { name: from() },
    destination: { name: to() },
    departDate: depart(),
    returnDate: ret() || undefined,
    passengers: pax(),
    cabin: cabin() || undefined,
  });
  const ready = () => from().trim() !== "" && to().trim() !== "" && depart() !== "";
  const buildLinks = async () => {
    setError(null);
    try {
      setLinks(await api().buildLinks(search()));
    } catch (err) {
      setError(err instanceof ConnectError ? err.rawMessage : "Couldn't build the flight search.");
    }
  };
  const saveFlight = () =>
    run(() => api().addFlight(props.trip.id, search(), props.trip.version)).then(() => setLinks([]));

  return (
    <section class="loci-card mb-6 p-4 sm:p-5" aria-label="Trip plan" data-testid="trip-plan">
      <h2 class="font-display text-lg font-semibold">Plan</h2>
      <Show when={error()}>
        <p role="alert" class="mt-2 text-sm text-destructive">{error()}</p>
      </Show>

      {/* Dates */}
      <div class="mt-4">
        <p class={label}>Dates</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input type="date" class={field} data-testid="plan-start" value={start()} onInput={(e) => setStart(e.currentTarget.value)} />
          <span class="text-sm text-muted-foreground">to</span>
          <input type="date" class={field} data-testid="plan-end" value={end()} min={start()} onInput={(e) => setEnd(e.currentTarget.value)} />
          <Button size="sm" data-testid="plan-save-dates" disabled={busy() || !start() || !end() || end() < start()} onClick={saveDates}>
            Save dates
          </Button>
        </div>
      </div>

      {/* Stays */}
      <div class="mt-5">
        <p class={label}>Where you stay</p>
        <For each={tripCities(props.trip)}>
          {(city) => (
            <div class="mt-2 rounded-xl border border-border px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium">{city}</span>
                <Show when={stayFor(city)} fallback={<span class="text-xs text-muted-foreground">No hotel yet</span>}>
                  {(s) => (
                    <span class="text-sm">
                      {s().name}
                      <Show when={s().starRating}> · {s().starRating}★</Show>
                    </span>
                  )}
                </Show>
              </div>
              <Show
                when={cityCoords(props.trip, city)}
                fallback={<p class="mt-1 text-xs text-muted-foreground">We can't search hotels in {city}: the trip has no map position for it yet.</p>}
              >
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    class={field}
                    data-testid={`plan-stars-${city}`}
                    onChange={(e) => setStars({ ...stars(), [city]: Number(e.currentTarget.value) })}
                  >
                    <option value="0">Any stars</option>
                    <option value="3">3★</option>
                    <option value="4">4★</option>
                    <option value="5">5★</option>
                  </select>
                  <Button size="sm" variant="outline" data-testid={`plan-find-${city}`} onClick={() => findHotels(city)}>
                    Find hotels
                  </Button>
                </div>
                <ul class="mt-2 space-y-1">
                  <For each={found()[city] ?? []}>
                    {(h) => (
                      <li>
                        <button
                          type="button"
                          data-testid="plan-hotel"
                          disabled={busy()}
                          class="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-60"
                          onClick={() => pickHotel(city, h)}
                        >
                          {h.name}
                          <Show when={h.star_rating}> · {h.star_rating}★</Show>
                          <Show when={h.rating}> · {h.rating?.toFixed(1)}</Show>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Flights */}
      <div class="mt-5">
        <p class={label}>Flights</p>
        <For each={props.trip.flights}>
          {(f) => (
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span>
                {f.origin.name} → {f.destination.name} · {f.departDate}
                <Show when={f.returnDate}> – {f.returnDate}</Show>
              </span>
              <span class="flex flex-wrap gap-2">
                <For each={f.links}>
                  {(l) => <a class="text-primary underline-offset-2 hover:underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>}
                </For>
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:text-destructive"
                  disabled={busy()}
                  onClick={() => run(() => api().removeFlight(props.trip.id, f.id, props.trip.version))}
                >
                  Remove
                </button>
              </span>
            </div>
          )}
        </For>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <input class={field} placeholder="From (city or airport)" data-testid="plan-from" value={from()} onInput={(e) => setFrom(e.currentTarget.value)} />
          <input class={field} placeholder="To" data-testid="plan-to" value={to()} onInput={(e) => setTo(e.currentTarget.value)} />
          <input type="date" class={field} data-testid="plan-depart" value={depart()} onInput={(e) => setDepart(e.currentTarget.value)} />
          <input type="date" class={field} data-testid="plan-return" value={ret()} min={depart()} onInput={(e) => setRet(e.currentTarget.value)} />
          <input type="number" min="1" max="9" class={field} aria-label="Travellers" value={pax()} onInput={(e) => setPax(Math.min(9, Math.max(1, Number(e.currentTarget.value) || 1)))} />
          <select class={field} aria-label="Cabin" onChange={(e) => setCabin(e.currentTarget.value as FlightCabinName | "")}>
            <option value="">Any cabin</option>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" data-testid="plan-links" disabled={!ready()} onClick={buildLinks}>
            Search flights
          </Button>
          <For each={links()}>
            {(l) => <a class="text-sm text-primary underline-offset-2 hover:underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>}
          </For>
          <Show when={links().length > 0}>
            <Button size="sm" data-testid="plan-save-flight" disabled={busy()} onClick={saveFlight}>
              Save to trip
            </Button>
          </Show>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">Prices are on the airline sites; Loci only saves your search.</p>
      </div>
    </section>
  );
};

export default TripPlanPanel;
```

Before Step 4, check two things:
- **The `Button` import path:** `grep -rn 'from "~/ui/button"' src | head -1` confirms it.
- **`font-display`:** `grep -n "font-display" src/styles/*.css`. If the class doesn't exist, use the heading class `TripPreferences` uses.

- [ ] **Step 4:** Run `pnpm exec vitest run src/components/trip/TripPlanPanel.test.ts && pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5:** Format the two files and commit them: `feat(trips): Plan panel — dates, a stay per city by stars, flight searches`.

---

### Task 4: Wire the panel and the chat entry into the trip page

**Files:** `src/routes/trips/[id].tsx` and `src/components/trip/TripHero.tsx`.

- [ ] **Step 1:** In `[id].tsx`, before `<TripPreferences …/>` (around line 307), render the panel for the owner only:

```tsx
<Show when={!t.owner}>
  <TripPlanPanel
    trip={t}
    onUpdated={(updated) => queryClient.setQueryData(tripKeys.detail(updated.id), updated)}
    onConflict={() => { setConflict(true); tripQuery.refetch(); }}
  />
</Show>
```

Import `TripPlanPanel`, `tripKeys` and `useQueryClient` from `@tanstack/solid-query`, and `const queryClient = useQueryClient();` if the page doesn't have them yet. `owner` is set only when someone other than the owner reads the trip; check that in `trips.ts`.

- [ ] **Step 2:** In `TripHero.tsx`'s action row, before the Share button, add a link to chat about this trip:

```tsx
<A
  href={`/chat?trip=${encodeURIComponent(props.tripId)}`}
  class="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
  data-testid="trip-ask-planner"
>
  <MessageCircle class="h-4 w-4" aria-hidden="true" />
  Ask the planner
</A>
```

Import `A` from `@solidjs/router` and `MessageCircle` from `lucide-solid`.

- [ ] **Step 3:** Run `pnpm typecheck && pnpm test`.
Expected: PASS.

- [ ] **Step 4:** Format the two files and commit: `feat(trips): Plan panel on the trip page, and a way into chat about the trip`.

---

### Task 5: The stream carries the trip and its proposals

**Files:**
- Modify `src/lib/streaming/chatStream.ts`.
- Test: append to `src/lib/streaming/chatStream.test.ts`.

**Interfaces:**
- Produces:
  - `LociStreamEvent` member `{ kind: "action_proposal"; proposal: ActionProposal }`, where `ActionProposal` is the proto type re-exported.
  - `ChatStreamParams.tripId?: string`.

- [ ] **Step 1: Failing tests.** Read the top of `chatStream.test.ts` first. Its existing helpers (proto event builders, `mapPayload` or the exported mapper) set the exact call to use. Then append:

```ts
describe("trip actions", () => {
  it("maps an action_proposal payload", () => {
    const ev = create(StreamEventSchema, {
      eventId: "e1",
      payload: { case: "actionProposal", value: { proposal: { id: "p1", tripId: "t1", summary: "Set dates" } } },
    });
    const out = mapEvent(ev); // use the module's exported mapper as the other tests do
    expect(out).toMatchObject({ kind: "action_proposal", eventId: "e1" });
    expect((out as any).proposal.id).toBe("p1");
  });

  it("an empty action_proposal payload maps to nothing", () => {
    const ev = create(StreamEventSchema, { payload: { case: "actionProposal", value: {} } });
    expect(mapEvent(ev)).toBeNull();
  });

  it("sends trip_id only when there is one", () => {
    expect(buildRequest({ message: "x", tripId: "t1" }).tripId).toBe("t1");
    expect(buildRequest({ message: "x" }).tripId).toBeUndefined();
    expect(buildRequest({ message: "x", tripId: "" }).tripId).toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run src/lib/streaming/chatStream.test.ts`.
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement.**
  - Add to the `LociStreamEvent` union:

    ```ts
    | { kind: "action_proposal"; proposal: ActionProposal }
    ```

  - Add a case in the payload switch, next to `gastronomy`:

    ```ts
    case "actionProposal":
      // A change to the turn's trip the traveller can confirm (ApplyTripAction).
      return p.value.proposal ? { kind: "action_proposal", proposal: p.value.proposal } : null;
    ```

  - Add `/** The trip this chat is about: its turns propose changes to it. */ tripId?: string;` to `ChatStreamParams`, and `tripId: params.tripId || undefined,` to `buildRequest`.
  - Import `type ActionProposal` from `chat_pb.js` and re-export it (`export type { ActionProposal }`).

- [ ] **Step 4:** Run `pnpm exec vitest run src/lib/streaming/ && pnpm typecheck`.
Expected: PASS. `streaming-service.ts`'s `project()` ignores kinds it doesn't handle; confirm that typecheck doesn't flag an exhaustive switch there. If it does, add `case "action_proposal": break;` with the comment `// chat renders these as cards (useChat onEvent)`.

- [ ] **Step 5:** Commit: `feat(chat): stream trip_id and action proposals`.

---

### Task 6: TripActionCard and the Apply/Dismiss API

**Files:**
- Create `src/lib/api/trip-actions.ts` and `src/components/chat/TripActionCard.tsx`.
- Test in `src/components/chat/TripActionCard.test.ts`.

**Interfaces:**
- Produces:
  - `interface TripActionApi { apply(proposalId: string, optionIndex: number | undefined, baseVersion: bigint): Promise<{ trip?: ProtoTripDraft; confirmation?: ConversationMessage }>; dismiss(proposalId: string): Promise<void> }`, and `tripActionApi`.
  - `TripActionCard(props: { proposal: ActionProposal; baseVersion: bigint; onApplied(trip: Trip | undefined, confirmation?: ConversationMessage): void; onDismissed(): void; api?: TripActionApi })`.

- [ ] **Step 1: Failing test**

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ActionProposalSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { TripDraftSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import TripActionCard from "./TripActionCard";
import type { TripActionApi } from "~/lib/api/trip-actions";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.innerHTML = ""; });

const hotels = create(ActionProposalSchema, {
  id: "p1", tripId: "t1", summary: "4★ hotels in Lisbon: pick one to stay at.",
  action: { kind: { case: "searchHotels", value: { cityName: "Lisbon", minStars: 4, maxStars: 4 } } },
  options: [
    { label: "Hotel Avenida · 4★", choice: { case: "stay", value: { cityName: "Lisbon", name: "Hotel Avenida" } } },
    { label: "Lisboa Plaza · 4★", choice: { case: "stay", value: { cityName: "Lisbon", name: "Lisboa Plaza" } } },
  ],
});
const dates = create(ActionProposalSchema, {
  id: "p2", tripId: "t1", summary: "Set the trip's dates to 12 Nov – 17 Nov 2026.",
  action: { kind: { case: "setDates", value: { startDate: "2026-11-12", endDate: "2026-11-17" } } },
});

const api = (over: Partial<TripActionApi> = {}): TripActionApi => ({
  apply: vi.fn(async () => ({ trip: create(TripDraftSchema, { id: "t1", title: "Lisbon", version: 4n }) })),
  dismiss: vi.fn(async () => {}),
  ...over,
});

const mount = (props: any) => {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => createComponent(TripActionCard, props), host);
  return host;
};

describe("TripActionCard", () => {
  it("a pick-one card applies the chosen option with the trip's version", async () => {
    const a = api();
    const onApplied = vi.fn();
    const host = mount({ proposal: hotels, baseVersion: 3n, onApplied, onDismissed: vi.fn(), api: a });
    expect(host.textContent).toContain("4★ hotels in Lisbon");
    (host.querySelectorAll('[data-testid="trip-action-option"]')[1] as HTMLElement).click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p1", 1, 3n);
    expect(onApplied.mock.calls[0][0].version).toBe(4n);
  });

  it("a write card confirms with no option", async () => {
    const a = api();
    const host = mount({ proposal: dates, baseVersion: 3n, onApplied: vi.fn(), onDismissed: vi.fn(), api: a });
    (host.querySelector('[data-testid="trip-action-confirm"]') as HTMLElement).click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p2", undefined, 3n);
  });

  it("a stale trip keeps the card and says why", async () => {
    const a = api({ apply: vi.fn(async () => { throw new ConnectError("trip version conflict", Code.FailedPrecondition); }) });
    const onApplied = vi.fn();
    const host = mount({ proposal: dates, baseVersion: 3n, onApplied, onDismissed: vi.fn(), api: a });
    (host.querySelector('[data-testid="trip-action-confirm"]') as HTMLElement).click();
    await flush();
    expect(onApplied).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="trip-action-error"]')?.textContent).toContain("changed");
  });

  it("Not now dismisses on the server", async () => {
    const a = api();
    const onDismissed = vi.fn();
    const host = mount({ proposal: dates, baseVersion: 3n, onApplied: vi.fn(), onDismissed, api: a });
    (host.querySelector('[data-testid="trip-action-dismiss"]') as HTMLElement).click();
    await flush();
    expect(a.dismiss).toHaveBeenCalledWith("p2");
    expect(onDismissed).toHaveBeenCalled();
  });

  it("a pick-one card with no options has nothing to confirm", () => {
    const empty = create(ActionProposalSchema, { ...hotels, options: [], summary: "No 5★ hotels found near Lisbon." });
    const host = mount({ proposal: empty, baseVersion: 3n, onApplied: vi.fn(), onDismissed: vi.fn(), api: api() });
    expect(host.querySelector('[data-testid="trip-action-confirm"]')).toBeNull();
    expect(host.querySelector('[data-testid="trip-action-option"]')).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run src/components/chat/TripActionCard.test.ts`.
Expected: FAIL (no module).

- [ ] **Step 3: Implement** `src/lib/api/trip-actions.ts`:

```ts
// The chat agent's proposed trip changes (ChatService.ApplyTripAction /
// DismissTripAction). The proposal lives on the server; the client sends its
// id, the option picked, and the trip version the card was shown against.
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ApplyTripActionRequestSchema,
  DismissTripActionRequestSchema,
  type ConversationMessage,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { TripDraft as ProtoTripDraft } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { chatService } from "../api";

/** Components take this so tests can fake it. */
export interface TripActionApi {
  apply(
    proposalId: string,
    optionIndex: number | undefined,
    baseVersion: bigint,
  ): Promise<{ trip?: ProtoTripDraft; confirmation?: ConversationMessage }>;
  dismiss(proposalId: string): Promise<void>;
}

export const tripActionApi: TripActionApi = {
  async apply(proposalId, optionIndex, baseVersion) {
    const res = await chatService.applyTripAction(
      create(ApplyTripActionRequestSchema, { proposalId, optionIndex, baseVersion }),
    );
    return { trip: res.trip, confirmation: res.confirmation };
  },
  async dismiss(proposalId) {
    await chatService.dismissTripAction(create(DismissTripActionRequestSchema, { proposalId }));
  },
};

/** What the card says when a change can't be made. */
export const tripActionErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.FailedPrecondition:
        return err.rawMessage.includes("version")
          ? "This trip changed since the suggestion. Ask again to get a fresh one."
          : "This suggestion was already used or has expired. Ask again.";
      case Code.NotFound:
        return "This suggestion is no longer available.";
      case Code.InvalidArgument:
        return err.rawMessage || "That change can't be made to this trip.";
    }
  }
  return "Couldn't make that change. Try again.";
};
```

Check the generated message on `trip.ErrVersionConflict` (the server's `"trip version conflict"`) so the `includes("version")` branch matches it.

Implement `src/components/chat/TripActionCard.tsx`:

```tsx
import { For, Show, createSignal, type Component } from "solid-js";
import type { ActionProposal, ConversationMessage } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { mapTrip, type Trip } from "~/lib/api/trips";
import { tripActionApi, tripActionErrorMessage, type TripActionApi } from "~/lib/api/trip-actions";
import { ProactiveCaption } from "./ProactiveCaption";

export interface TripActionCardProps {
  proposal: ActionProposal;
  /** The trip version this card was shown against. */
  baseVersion: bigint;
  onApplied: (trip: Trip | undefined, confirmation?: ConversationMessage) => void;
  onDismissed: () => void;
  /** Injected in tests. */
  api?: TripActionApi;
}

/**
 * A change the agent proposes to the trip this chat is about. Nothing changes
 * until Confirm (or a pick, for hotels and flights); the server applies it
 * once, against the version the card was shown with.
 */
const TripActionCard: Component<TripActionCardProps> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const api = () => props.api ?? tripActionApi;
  const kind = () => props.proposal.action?.kind.case;
  const pickOne = () => kind() === "searchHotels";

  const apply = async (optionIndex?: number) => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api().apply(props.proposal.id, optionIndex, props.baseVersion);
      props.onApplied(res.trip ? mapTrip(res.trip) : undefined, res.confirmation);
    } catch (err) {
      setError(tripActionErrorMessage(err));
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await api().dismiss(props.proposal.id);
    } catch {
      // Dismissing is a courtesy to the server; the card goes either way.
    }
    props.onDismissed();
  };

  const pill = "h-9 rounded-full px-4 text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div class="flex justify-start" data-testid="trip-action">
      <div class="max-w-[94%] min-w-0 sm:max-w-[440px]">
        <ProactiveCaption label="Trip planner" />
        <section aria-label="Proposed trip change" class="rounded-2xl bg-[var(--muse-agent-bubble)] px-4 py-3 text-[var(--muse-text)]">
          <p class="text-[15px] font-semibold leading-snug">{props.proposal.summary}</p>

          <Show when={pickOne()}>
            <ul class="mt-2 space-y-1">
              <For each={props.proposal.options}>
                {(o, i) => (
                  <li>
                    <button
                      type="button"
                      data-testid="trip-action-option"
                      disabled={busy()}
                      onClick={() => apply(i())}
                      class="w-full rounded-xl bg-[var(--muse-pill)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    >
                      <span class="font-medium">{o.label}</span>
                      <Show when={o.detail}>
                        <span class="block text-[12px] text-[var(--muse-text-secondary)]">{o.detail}</span>
                      </Show>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={kind() === "searchFlights" && props.proposal.options[0]?.choice.case === "flight"}>
            <div class="mt-2 flex flex-wrap gap-2">
              <For each={props.proposal.options[0]?.choice.case === "flight" ? props.proposal.options[0].choice.value.links : []}>
                {(l) => <a class="text-sm underline underline-offset-2" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>}
              </For>
            </div>
          </Show>

          <Show when={error()}>
            <p role="alert" class="mt-2 text-[13px] text-destructive" data-testid="trip-action-error">{error()}</p>
          </Show>

          <div class="mt-3 flex flex-wrap gap-2">
            <Show when={!pickOne() && (kind() !== "searchFlights" || props.proposal.options.length > 0)}>
              <button
                type="button"
                data-testid="trip-action-confirm"
                disabled={busy()}
                onClick={() => apply(kind() === "searchFlights" ? 0 : undefined)}
                class={`${pill} bg-[var(--muse-user-bubble)] font-semibold text-[var(--muse-user-text)]`}
              >
                {busy() ? "Updating…" : kind() === "searchFlights" ? "Save to trip" : "Confirm"}
              </button>
            </Show>
            <button
              type="button"
              data-testid="trip-action-dismiss"
              disabled={busy()}
              onClick={dismiss}
              class={`${pill} bg-[var(--muse-pill)] font-medium text-[var(--muse-text)]`}
            >
              Not now
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TripActionCard;
```

- [ ] **Step 4:** Run `pnpm exec vitest run src/components/chat/TripActionCard.test.ts && pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5:** Format the files and commit: `feat(chat): trip action cards — confirm or dismiss what the planner proposes`.

---

### Task 7: The chat binds to a trip and shows the cards

**Files:** `src/lib/hooks/useChat.ts` and `src/routes/chat/index.tsx`.

**Interfaces:**
- `useChat(opts?: { tripId?: () => string | undefined })`.
- `ChatMessage.type` gains `"trip-action"`, with `tripAction?: ActionProposal`.
- `useChat` returns `applyTripAction(messageId, trip, confirmation)` and `dismissTripAction(messageId)`.

- [ ] **Step 1: Implement** `useChat.ts`.
  - **Signature:** change it to `export function useChat(opts: { tripId?: () => string | undefined } = {})`. Add `"trip-action"` to `ChatMessage.type`, and the field `/** Set on "trip-action" messages: the change the planner proposes. */ tripAction?: ActionProposal;`.
  - **Both `startStream` param objects** (around lines 319 and 373) get `tripId: opts.tripId?.(),`.
  - **Both handler objects** replace `onEvent: dispatchMuse` with `onEvent: onStreamEvent`, defined once:

    ```ts
    // Proposals arrive as their own events; each becomes a card in the thread.
    let proposedThisTurn = 0;
    const onStreamEvent = (event: LociStreamEvent) => {
      dispatchMuse(event);
      if (event.kind !== "action_proposal") return;
      proposedThisTurn++;
      appendMessage({
        id: `trip-action-${event.proposal.id}`,
        type: "trip-action",
        content: event.proposal.summary,
        timestamp: new Date(),
        tripAction: event.proposal,
      });
    };
    ```

    Reset `proposedThisTurn = 0` at the start of `sendMessage`, before either stream starts.
  - **Turn wording.** In `finalizeStream`, when `proposedThisTurn > 0`, patch the placeholder instead of announcing results:

    ```ts
    if (proposedThisTurn > 0) {
      patchMessage(streamId, {
        content: "Here's what I can change on your trip — confirm the ones you want.",
        hasItinerary: false,
        showResults: false,
        streaming: false,
      });
      return;
    }
    ```

    Put this after the session bookkeeping and before the existing `patchMessage`.
  - **Add** the two actions, and return them from the hook:

    ```ts
    /** ApplyTripAction succeeded: the card gives way to the confirmation. */
    const applyTripAction = (messageId: string, trip: Trip | undefined, confirmation?: ConversationMessage) => {
      if (trip) queryClient.setQueryData(tripKeys.detail(trip.id), trip);
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== messageId);
        return confirmation ? [...rest, toChatMessage(confirmation)] : rest;
      });
    };
    const dismissTripAction = (messageId: string) =>
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    ```

  - **Imports:** `type LociStreamEvent, type ActionProposal` from `~/lib/streaming/chatStream`, and `tripKeys, type Trip` from `~/lib/api/trips`.
  - **Proposal ids:** `appendMessage` and `toChatMessage` already exist; reuse them. Check the stream's `eventId` dedup so a resumed stream doesn't append the same card twice. The message id derives from the proposal id; skip an append whose id is already in `messages()`.

- [ ] **Step 2: Implement** `routes/chat/index.tsx`.
  - Read the trip: `const [search] = useSearchParams(); const tripId = () => (typeof search.trip === "string" ? search.trip : undefined);`.
  - Change to `const chat = useChat({ tripId });` and `const tripQuery = useTrip(tripId);`.
  - Above the messages, add a slim banner:

    ```tsx
    <Show when={tripQuery.data}>
      {(t) => (
        <div class="mx-auto mb-3 max-w-3xl rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm" data-testid="chat-trip-banner">
          Planning <A href={`/trips/${t().id}`} class="font-medium underline-offset-2 hover:underline">{t().title}</A>. Ask for dates, hotels, more days or flights.
        </div>
      )}
    </Show>
    ```

  - In the `<For each={chat.messages()}>` render, wrap the existing `<Show …watch-proposal…>` in a `Show` for trip actions:

    ```tsx
    <Show
      when={message.type === "trip-action" && message.tripAction}
      fallback={/* the existing watch-proposal Show, unchanged */}
    >
      {(proposal) => (
        <TripActionCard
          proposal={proposal()}
          baseVersion={tripQuery.data?.version ?? 0n}
          onApplied={(trip, confirmation) => chat.applyTripAction(message.id, trip, confirmation)}
          onDismissed={() => chat.dismissTripAction(message.id)}
        />
      )}
    </Show>
    ```

  - Import `useSearchParams` and `A` from `@solidjs/router`, `useTrip` from `~/lib/api/trips`, and `TripActionCard` from `~/components/chat/TripActionCard`.
  - `useTrip` must accept `undefined` and stay idle. Its signature is `useTrip(id: () => string | undefined)`; check that it sets `enabled: !!id()`, and add that if it doesn't.

- [ ] **Step 3:** Run `pnpm typecheck && pnpm test && pnpm lint`.
Expected: PASS, with lint reporting no new warnings in touched files.

- [ ] **Step 4:** Format the touched files and commit: `feat(chat): chat about a trip — proposals as cards, applied to the trip`.

---

### Task 8: Ship and prove

- [ ] **Step 1:** Run `pnpm build`.
Expected: success.
- [ ] **Step 2:** Open the PR. After CI is green, merge it.
- [ ] **Step 3:** Check the live bundle.
  - Wait for the Workers deploy.
  - Fetch `https://lociai.fyi` and grep its JS chunks for `ApplyTripAction` and `api.lociai.fyi`.
  - If `localhost:8000` appears instead, re-dispatch the Actions deploy, as the double-deploy race requires.
- [ ] **Step 4:** Browser check with claude-in-chrome, signed out (signing in is the owner's job):
  - `/chat?trip=x` and `/chat` both render.
  - No console errors.
- [ ] **Step 5:** Signed-in QA, owed by the owner:
  1. Open a trip and use **Ask the planner**.
  2. Send "4-star hotels, 12 to 15 November, flights from New York".
  3. Expect cards, and that confirming each one updates the trip page.

---

## Spec deviations (deliberate)

- **No "Build N-day itinerary" button on the panel.** Re-planning is a chat action (`regenerate_days`). There is no TripService RPC for it, and the panel links to the planner instead.
- **Hotel search uses `FavoritesService.GetNearbyHotels`**, star-filtered in the browser, because the web has no POIService hotel call.
- **The calendar's "Pin dates" still saves through SaveTrip.** The server moves start and end with day 1 (plan 1 fix).
