import type { Trip } from "~/lib/api/trips";
import { getAuthToken } from "~/lib/auth/tokens";

// Per account. The cache used to be one key for the whole browser, so after a
// sign-out (or on a shared machine) the next person's /offline listed — and
// /trips/{id} placeholder-rendered — the previous person's trips. Each account
// now has its own key, nothing is read or written without one, and signing
// out clears them all.
const KEY_PREFIX = "loci.offline.trips.v2:";
/** The old, unscoped key. Never read; removed on the next write or sign-out. */
const LEGACY_KEY = "loci.offline.trips.v1";
const MAX_TRIPS = 12;

/** The signed-in account's id, read from the access token's payload. */
export function currentOfflineUserId(): string | null {
  const token = getAuthToken();
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      user_id?: unknown;
      sub?: unknown;
    };
    const id = json.user_id ?? json.sub;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

export const offlineCacheKey = (userId: string) => `${KEY_PREFIX}${userId}`;

export interface CachedTripSummary {
  id: string;
  title: string;
  cityName: string;
  dayCount: number;
  updatedAt: string;
}

interface CacheFile {
  trips: Record<string, unknown>;
  order: string[]; // newest-first ids
}

function read(userId: string | null): CacheFile {
  if (typeof localStorage === "undefined" || !userId) return { trips: {}, order: [] };
  try {
    const raw = localStorage.getItem(offlineCacheKey(userId));
    if (!raw) return { trips: {}, order: [] };
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed?.trips || !Array.isArray(parsed.order)) return { trips: {}, order: [] };
    return parsed;
  } catch {
    return { trips: {}, order: [] };
  }
}

function write(userId: string, file: CacheFile): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(offlineCacheKey(userId), JSON.stringify(file));
  } catch (e) {
    console.warn("offline trip cache write failed", e);
  }
}

function serializeTrip(trip: Trip): unknown {
  return { ...trip, version: trip.version.toString() };
}

function deserializeTrip(raw: unknown): Trip | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return undefined;
  return {
    ...(o as unknown as Trip),
    version: BigInt(typeof o.version === "string" || typeof o.version === "number" ? o.version : 0),
  };
}

/** Persist a full trip for offline reopen. Keeps last MAX_TRIPS. */
export function cacheTripOffline(trip: Trip, userId = currentOfflineUserId()): void {
  if (!userId) return;
  const file = read(userId);
  file.trips[trip.id] = serializeTrip(trip);
  file.order = [trip.id, ...file.order.filter((id) => id !== trip.id)].slice(0, MAX_TRIPS);
  for (const id of Object.keys(file.trips)) {
    if (!file.order.includes(id)) delete file.trips[id];
  }
  write(userId, file);
}

export function getCachedTrip(id: string, userId = currentOfflineUserId()): Trip | undefined {
  if (!id) return undefined;
  return deserializeTrip(read(userId).trips[id]);
}

export function listCachedTrips(userId = currentOfflineUserId()): CachedTripSummary[] {
  const file = read(userId);
  return file.order
    .map((id) => deserializeTrip(file.trips[id]))
    .filter((t): t is Trip => !!t)
    .map((t) => ({
      id: t.id,
      title: t.title,
      cityName: t.cityName,
      dayCount: t.days?.length ?? 0,
      updatedAt: t.updatedAt,
    }));
}

/**
 * Forget offline trips. With a user id, just that account's (the /offline
 * page's "clear" button); without one, every account's and the old unscoped
 * key (sign-out).
 */
export function clearOfflineTripCache(userId?: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (userId) {
    localStorage.removeItem(offlineCacheKey(userId));
    return;
  }
  const doomed: string[] = [LEGACY_KEY];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) doomed.push(key);
  }
  for (const key of doomed) localStorage.removeItem(key);
}
