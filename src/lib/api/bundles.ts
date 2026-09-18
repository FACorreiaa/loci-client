import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  BundleService,
  ClaimBundleRequestSchema,
  CreateBundleCheckoutRequestSchema,
  GetBundleRequestSchema,
  ListBundlesRequestSchema,
  ListMyBundlesRequestSchema,
  type Bundle as ProtoBundle,
  type BundleDetail as ProtoBundleDetail,
} from "@buf/loci_loci-proto.bufbuild_es/loci/bundle/v1/bundle_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { useAuthGate } from "../auth/useAuthGate";
import type { ItineraryStop } from "../itinerary/createItineraryStream";
import { pointsFromDays, type PackPoint } from "../bundles/points";

const bundleClient = createClient(BundleService, transport);

export interface PackSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cityName: string;
  countryCode: string;
  theme: string;
  months: number[];
  dayCount: number;
  stopCount: number;
  coverImageUrl?: string;
  isPaid: boolean;
  priceCents: number;
  currency: string;
  owned: boolean;
}

export interface PackDay {
  dayNumber: number;
  title: string;
  stops: ItineraryStop[];
}

export type { PackPoint };

export interface PackDetail {
  pack: PackSummary;
  days: PackDay[];
  /** Every stop that has a position, in visiting order. */
  points: PackPoint[];
  lockedDayCount: number;
}

const toPack = (b: ProtoBundle): PackSummary => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  summary: b.summary,
  cityName: b.cityName,
  countryCode: b.countryCode,
  theme: b.theme,
  months: [...b.months],
  dayCount: b.dayCount,
  stopCount: b.stopCount,
  coverImageUrl: b.coverImageUrl,
  isPaid: b.isPaid,
  priceCents: b.priceCents,
  currency: b.currency || "usd",
  owned: b.owned,
});

/** Exported for testing: the list and the map must not disagree. */
export const toDetail = (d: ProtoBundleDetail): PackDetail => ({
  pack: d.bundle ? toPack(d.bundle) : ({} as PackSummary),
  lockedDayCount: d.lockedDayCount,
  points: pointsFromDays(d.days),
  days: d.days.map((day) => ({
    dayNumber: day.dayNumber,
    title: day.title,
    stops: day.stops.map((s, i) => ({
      key: s.id || `${day.dayNumber}-${i}`,
      name: s.name,
      blurb: s.notes,
      // ItineraryStop.day is 0-based to match trip-kit's grouping, while the
      // server numbers days from 1. Passing day_number straight through
      // rendered a three-day pack as "Day 2" to "Day 4" with no Day 1.
      day: day.dayNumber - 1,
      placeId: s.poiId || undefined,
      timeToSpend: s.durationMinutes ? `${s.durationMinutes} min` : undefined,
      // These stops are authored, not streamed: there is no enrichment pass
      // still to come, so they arrive finished.
      enriched: true,
    })),
  })),
});

export interface PackFilters {
  cityName?: string;
  theme?: string;
  month?: number;
  onlyFree?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * The catalog. Public on purpose: no auth gate, because a logged-out visitor
 * is the audience. Gating this with `useAuthGate` would leave a stranger
 * looking at a spinner forever.
 *
 * A token is still sent when there is one — the same call then reports which
 * packs this person already owns, so the cards need no second request.
 */
export function usePacks(filters: () => PackFilters = () => ({})) {
  return useAppQuery(() => {
    const f = filters();
    return {
      queryKey: ["packs", "list", f],
      queryFn: async (): Promise<{ packs: PackSummary[]; total: number }> => {
        const res = await bundleClient.listBundles(
          create(ListBundlesRequestSchema, {
            cityName: f.cityName || undefined,
            theme: f.theme || undefined,
            month: f.month || undefined,
            onlyFree: f.onlyFree || undefined,
            pagination: create(PaginationRequestSchema, {
              page: f.page ?? 1,
              pageSize: f.pageSize ?? 24,
            }),
          }),
        );
        return {
          packs: (res.bundles ?? []).map(toPack),
          total: res.pagination?.totalRecords ?? 0,
        };
      },
      staleTime: 5 * 60 * 1000,
    };
  });
}

/** One pack, with only the days the caller is entitled to. */
export function usePack(slug: () => string | undefined) {
  return useAppQuery(() => ({
    queryKey: ["packs", "detail", slug()],
    enabled: !!slug(),
    queryFn: async (): Promise<PackDetail | null> => {
      const s = slug();
      if (!s) return null;
      const res = await bundleClient.getBundle(create(GetBundleRequestSchema, { slug: s }));
      return toDetail(res);
    },
    staleTime: 60 * 1000,
  }));
}

/** The packs this person has bought. Authenticated, so it is gated. */
export function useMyPacks() {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["packs", "mine"],
    enabled: gate(),
    queryFn: async (): Promise<PackSummary[]> => {
      const res = await bundleClient.listMyBundles(
        create(ListMyBundlesRequestSchema, {
          pagination: create(PaginationRequestSchema, { page: 1, pageSize: 50 }),
        }),
      );
      return (res.bundles ?? []).map(toPack);
    },
  }));
}

/**
 * Start checkout for a pack.
 *
 * Deliberately not `useCreateCheckoutSession({ mode: "payment" })` from
 * billing.ts: the server ignores the mode on that RPC, because a client that
 * can name a mode and a price can name its own amount. This one sends only a
 * bundle id and the server resolves the price itself.
 */
export function useCreatePackCheckout() {
  return useMutation(() => ({
    mutationFn: async (vars: { bundleId: string; successUrl: string; cancelUrl: string }) => {
      const res = await bundleClient.createBundleCheckout(
        create(CreateBundleCheckoutRequestSchema, vars),
      );
      return { sessionId: res.sessionId, url: res.url };
    },
  }));
}

/** Copy a pack into the caller's own trips. */
export function useClaimPack() {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (bundleId: string) => {
      const res = await bundleClient.claimBundle(create(ClaimBundleRequestSchema, { bundleId }));
      return res.tripId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trips"] });
    },
  }));
}
