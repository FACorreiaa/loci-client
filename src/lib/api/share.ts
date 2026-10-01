// Share API client using ConnectRPC ShareService
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/solid-query";
import {
  ShareService,
  CreateShareLinkRequestSchema,
  GetShareMetadataRequestSchema,
  GetSharedContentRequestSchema,
  ShareContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/share/share_pb.js";
import { transport } from "../connect-transport";
import { getAuthToken, authAPI } from "../api";

const shareClient = createClient(ShareService, transport);

// Cache for user ID
let cachedUserId: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getUserId = async (): Promise<string | null> => {
  const now = Date.now();
  if (cachedUserId && now - cacheTimestamp < CACHE_TTL) {
    return cachedUserId;
  }

  const token = getAuthToken();
  if (!token) return null;

  try {
    const session = await authAPI.validateSession();
    if (session.valid && session.user_id) {
      cachedUserId = session.user_id;
      cacheTimestamp = now;
      return cachedUserId;
    }
  } catch (e) {
    console.warn("Failed to get user ID:", e);
  }
  return null;
};

// Map content type string to proto enum
export const contentTypeToShareProto = (type: string): ShareContentType => {
  switch (type.toLowerCase()) {
    case "poi":
    case "place":
      return ShareContentType.POI;
    case "hotel":
      return ShareContentType.HOTEL;
    case "restaurant":
      return ShareContentType.RESTAURANT;
    case "itinerary":
      return ShareContentType.ITINERARY;
    case "list":
      return ShareContentType.LIST;
    case "activity":
      return ShareContentType.ACTIVITY;
    default:
      return ShareContentType.UNSPECIFIED;
  }
};

/**
 * Create a shareable link for content
 */
export const createShareLink = async (
  contentType: string,
  contentId: string,
  title: string,
  description?: string,
  imageUrl?: string,
): Promise<{ shareCode: string; shareUrl: string } | null> => {
  const userId = await getUserId();
  if (!userId) {
    console.error("User not authenticated");
    return null;
  }

  try {
    const response = await shareClient.createShareLink(
      create(CreateShareLinkRequestSchema, {
        userId,
        contentType: contentTypeToShareProto(contentType),
        contentId,
        title,
        description: description || "",
        imageUrl: imageUrl || "",
      }),
    );

    if (response.success) {
      return {
        shareCode: response.shareCode,
        shareUrl: response.shareUrl,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to create share link:", error);
    return null;
  }
};

/**
 * Get metadata for a shared item
 */
export const getShareMetadata = async (shareCode: string) => {
  try {
    const response = await shareClient.getShareMetadata(
      create(GetShareMetadataRequestSchema, { shareCode }),
    );

    if (response.success && response.metadata) {
      return response.metadata;
    }
    return null;
  } catch (error) {
    console.error("Failed to get share metadata:", error);
    return null;
  }
};

/**
 * Get full shared content
 */
export const getSharedContent = async (shareCode: string) => {
  try {
    const response = await shareClient.getSharedContent(
      create(GetSharedContentRequestSchema, { shareCode }),
    );

    if (response.success && response.content) {
      return response.content;
    }
    return null;
  } catch (error) {
    console.error("Failed to get shared content:", error);
    return null;
  }
};

/**
 * Copy share link to clipboard
 */
export const copyShareLink = async (shareUrl: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    return true;
  } catch (error) {
    console.error("Failed to copy share link:", error);
    return false;
  }
};

/**
 * Share via Web Share API if available
 */
export const shareViaWebShare = async (
  title: string,
  text: string,
  url: string,
): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Web Share failed:", error);
      }
      return false;
    }
  }
  return false;
};

/**
 * The share page's data. Reading is public; a dead code is an error so the
 * page can say so rather than render an empty card.
 */
export const useSharedContent = (code: () => string | undefined) =>
  useQuery(() => ({
    queryKey: ["share", "content", code() ?? ""],
    enabled: !!code(),
    retry: false,
    queryFn: async () => {
      const response = await shareClient.getSharedContent(
        create(GetSharedContentRequestSchema, { shareCode: code()! }),
      );
      if (!response.success || !response.content) {
        throw new Error(response.message || "This link has expired.");
      }
      return response.content;
    },
  }));
