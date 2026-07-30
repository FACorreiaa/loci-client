// Packing suggestions derived from a saved trip: its length, its cities'
// forecasts, the driving between them, and the traveller's stated interests.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  TripService,
  SuggestPackingRequestSchema,
  PackingCategory,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const tripClient = createClient(TripService, transport);

export type PackingCategoryName =
  | "essentials"
  | "clothing"
  | "weather"
  | "tech"
  | "health"
  | "travel"
  | "activity";

export interface PackingSuggestion {
  text: string;
  category: PackingCategoryName;
  /** Why this trip earned this item. Empty for universal essentials. */
  reason: string;
  /** Things it would be genuinely bad to forget. */
  essential: boolean;
}

export interface PackingSuggestions {
  suggestions: PackingSuggestion[];
  /** True when a stub forecast contributed, so weather items are guesses. */
  weatherIsEstimated: boolean;
  /** False when no forecast was available; weather items are then absent. */
  usedForecast: boolean;
}

const CATEGORY_NAMES: Record<number, PackingCategoryName> = {
  [PackingCategory.ESSENTIALS]: "essentials",
  [PackingCategory.CLOTHING]: "clothing",
  [PackingCategory.WEATHER]: "weather",
  [PackingCategory.TECH]: "tech",
  [PackingCategory.HEALTH]: "health",
  [PackingCategory.TRAVEL]: "travel",
  [PackingCategory.ACTIVITY]: "activity",
};

/**
 * Suggestions for what to pack for one trip.
 *
 * Cached for a while: the inputs (trip length, cities, interests) barely move,
 * and the forecast changes slowly enough that re-asking on every render would be
 * wasted work.
 */
export const useSuggestPacking = (tripId: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: ["packing", "suggestions", tripId() ?? ""],
    enabled: !!tripId(),
    staleTime: 30 * 60 * 1000,
    // A packing list is a nice-to-have on the trip page; do not retry hard.
    retry: 1,
    queryFn: async (): Promise<PackingSuggestions> => {
      const res = await tripClient.suggestPacking(
        create(SuggestPackingRequestSchema, { tripId: tripId()! }),
      );
      return {
        weatherIsEstimated: res.weatherIsEstimated,
        usedForecast: res.usedForecast,
        suggestions: res.suggestions.map((s) => ({
          text: s.text,
          category: CATEGORY_NAMES[s.category] ?? "essentials",
          reason: s.reason,
          essential: s.essential,
        })),
      };
    },
  }));
