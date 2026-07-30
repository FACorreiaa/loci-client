import { useQuery } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  DiscoverService,
  GetCategoryResultsRequestSchema,
  GetDiscoverPageRequestSchema,
  GetFeaturedRequestSchema,
  GetRecentDiscoveriesRequestSchema,
  GetTrendingRequestSchema,
  DiscoverResult as ProtoDiscoverResult,
  TrendingDiscovery as ProtoTrendingDiscovery,
  FeaturedCollection as ProtoFeaturedCollection,
} from "@buf/loci_loci-proto.bufbuild_es/loci/discover/discover_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { ChatSession as ProtoChatSession } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { transport } from "../connect-transport";
import { useAuthGate } from "../auth/useAuthGate";
import type {
  DiscoverPageData,
  TrendingDiscovery,
  FeaturedCollection,
  ChatSession,
  DiscoverResult,
  PaginationMetadata,
} from "./types";
import { useAppQuery } from "./authed-query";

const discoverClient = createClient(DiscoverService, transport);

const toTrending = (t: ProtoTrendingDiscovery): TrendingDiscovery => ({
  city_name: t.cityName || "",
  search_count: Number(t.searchCount ?? 0),
  emoji: t.emoji || "🗺️",
});

const toFeatured = (f: ProtoFeaturedCollection): FeaturedCollection => ({
  category: f.category || "",
  title: f.title || "",
  item_count: Number(f.itemCount ?? 0),
  emoji: f.emoji || "✨",
});

const toChatSession = (
  s: ProtoChatSession,
): ChatSession & { city_name?: string; conversation_history?: any[] } => ({
  id: s.id || "",
  profile_id: s.profileId || "",
  created_at: s.createdAt ? new Date(Number(s.createdAt.seconds) * 1000).toISOString() : "",
  updated_at: s.updatedAt ? new Date(Number(s.updatedAt.seconds) * 1000).toISOString() : "",
  city_name: (s as any).cityName || "",
  conversation_history: (s as any).conversationHistory || [],
});

const toDiscoverResult = (r: ProtoDiscoverResult): DiscoverResult => ({
  id: r.id || "",
  name: r.name || "",
  latitude: r.latitude ?? 0,
  longitude: r.longitude ?? 0,
  category: r.category || "",
  description: r.description || "",
  address: r.address || "",
  website: r.website || undefined,
  phone_number: r.phoneNumber || undefined,
  opening_hours: r.openingHours || undefined,
  price_level: r.priceLevel || "",
  rating: r.rating ?? 0,
  tags: r.tags || [],
  images: r.images || [],
  cuisine_type: r.cuisineType || undefined,
  star_rating: r.starRating || undefined,
});

// Get all discover page data via RPC. `enabled` gates the query on auth being
// ready — firing before the token loads yields a 401 that the refresh
// interceptor can mistake for a dead session and log the user out.
export function useDiscoverPageData(enabled?: () => boolean) {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["discover", "page"],
    enabled: gate(enabled),
    queryFn: async (): Promise<DiscoverPageData> => {
      const response = await discoverClient.getDiscoverPage(
        create(GetDiscoverPageRequestSchema, {}),
      );
      const data = response.data;
      return {
        trending: (data?.trending || []).map(toTrending),
        featured: (data?.featured || []).map(toFeatured),
        recent_discoveries: (data?.recentDiscoveries || []).map(toChatSession),
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  }));
}

// Get trending discoveries
export function useTrendingDiscoveries(limit = 5) {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["discover", "trending", limit],
    enabled: gate(),
    queryFn: async (): Promise<TrendingDiscovery[]> => {
      const response = await discoverClient.getTrending(
        create(GetTrendingRequestSchema, {
          limit,
        }),
      );
      return (response.trending || []).map(toTrending);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  }));
}

// Get featured collections
export function useFeaturedCollections(limit = 4) {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["discover", "featured", limit],
    enabled: gate(),
    queryFn: async (): Promise<FeaturedCollection[]> => {
      const response = await discoverClient.getFeatured(
        create(GetFeaturedRequestSchema, {
          limit,
        }),
      );
      return (response.featured || []).map(toFeatured);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  }));
}

// Get recent discoveries
export async function fetchRecentDiscoveries(
  page = 1,
  pageSize = 10,
): Promise<{
  sessions: ChatSession[];
  pagination?: PaginationMetadata;
}> {
  const response = await discoverClient.getRecentDiscoveries(
    create(GetRecentDiscoveriesRequestSchema, {
      pagination: create(PaginationRequestSchema, {
        page,
        pageSize,
      }),
    }),
  );

  return {
    sessions: (response.sessions || []).map(toChatSession),
    pagination: response.pagination && {
      total_records: Number(response.pagination.totalRecords ?? 0),
      page: Number(response.pagination.page ?? 1),
      page_size: Number(response.pagination.pageSize ?? pageSize),
      total_pages: Number(response.pagination.totalPages ?? 0),
      has_more: Boolean(response.pagination.hasMore),
    },
  };
}

// Get category results
export function useCategoryResults(category: string, cityName?: string, pageSize = 12) {
  return useAppQuery(() => ({
    queryKey: ["discover", "category", category, cityName, pageSize],
    queryFn: async (): Promise<DiscoverResult[]> => {
      const response = await discoverClient.getCategoryResults(
        create(GetCategoryResultsRequestSchema, {
          category,
          cityName,
          pagination: create(PaginationRequestSchema, {
            page: 1,
            pageSize,
          }),
        }),
      );
      return (response.results || []).map(toDiscoverResult);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!category,
  }));
}
