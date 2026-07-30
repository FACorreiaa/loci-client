// Freemium entitlement counters via EntitlementService.GetEntitlements.
// Uses Connect JSON over the shared transport base URL until the BSR package
// ships EntitlementService (then switch to createClient like billing.ts).
import { useQuery } from "@tanstack/solid-query";
import { getAuthToken } from "../auth/tokens";
import { useAppQuery } from "./authed-query";

const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

export interface Entitlements {
  plan: string;
  listsUsed: number;
  listsLimit: number; // -1 = unlimited
  placesSaved: number;
  placesLimit: number; // -1 = unlimited
  advancedFilters: boolean;
  exportFull: boolean;
}

function mapEntitlements(raw: Record<string, unknown>): Entitlements {
  return {
    plan: String(raw.plan ?? "free"),
    listsUsed: Number(raw.listsUsed ?? 0),
    listsLimit: Number(raw.listsLimit ?? 5),
    placesSaved: Number(raw.placesSaved ?? 0),
    placesLimit: Number(raw.placesLimit ?? 50),
    advancedFilters: Boolean(raw.advancedFilters),
    exportFull: Boolean(raw.exportFull),
  };
}

export async function fetchEntitlements(): Promise<Entitlements | null> {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(
    `${API_BASE_URL}/loci.entitlement.v1.EntitlementService/GetEntitlements`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    },
  );
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`GetEntitlements failed: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return mapEntitlements(data);
}

export function useEntitlements() {
  return useAppQuery(() => ({
    queryKey: ["entitlements"],
    queryFn: fetchEntitlements,
    staleTime: 60_000,
    retry: 1,
  }));
}
