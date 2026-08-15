// What Loci has learned about you, the evidence behind it, and how to remove it.
//
// The taste profile was previously visible but not checkable: a trait said
// "4 signals" with no way to ask which four, and the only control was a single
// button that erased everything. These hooks back a page where each belief can
// be inspected, disputed, and removed on its own.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  MemoryService,
  GetMemoryRequestSchema,
  ForgetTraitRequestSchema,
  ForgetEvidenceRequestSchema,
  type Trait,
  type Evidence,
} from "@buf/loci_loci-proto.bufbuild_es/loci/memory/memory_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const memoryClient = createClient(MemoryService, transport);

export const memoryQueryKey = ["memory"] as const;

function tsToMillis(ts?: Timestamp): number | undefined {
  if (!ts) return undefined;
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000);
}

export interface EvidenceView {
  id: string;
  // Pass to forgetEvidence to remove this one action.
  feedbackId: string;
  event: string;
  // Signed. Negative means this action was evidence *against* the trait —
  // skipping a suggestion counts.
  weight: number;
  poiId: string;
  poiName: string;
  cityName: string;
  occurredAt?: number;
}

export interface TraitView {
  key: string;
  label: string;
  // -1..1. Negative is an aversion, not a weak preference.
  score: number;
  // 0..1, rising with the number of signals.
  confidence: number;
  evidenceCount: number;
  updatedAt?: number;
  evidence: EvidenceView[];
}

export interface MemoryView {
  traits: TraitView[];
  personalizationEnabled: boolean;
  hasVector: boolean;
  signalCount: number;
  lastSignalAt?: number;
  generatedAt?: number;
}

function toEvidenceView(e: Evidence): EvidenceView {
  return {
    id: e.id,
    feedbackId: e.feedbackId,
    event: e.event,
    weight: e.weight,
    poiId: e.poiId,
    poiName: e.poiName,
    cityName: e.cityName,
    occurredAt: tsToMillis(e.occurredAt),
  };
}

function toTraitView(t: Trait): TraitView {
  return {
    key: t.key,
    label: t.label,
    score: t.score,
    confidence: t.confidence,
    evidenceCount: t.evidenceCount,
    updatedAt: tsToMillis(t.updatedAt),
    evidence: (t.evidence ?? []).map(toEvidenceView),
  };
}

/**
 * Reads the learned profile. Evidence is requested by default — the whole point
 * of the page is that a belief can be traced to what taught it.
 */
export function useMemory(includeEvidence = true) {
  return useAppQuery(() => ({
    queryKey: [...memoryQueryKey, includeEvidence] as const,
    queryFn: async (): Promise<MemoryView> => {
      const resp = await memoryClient.getMemory(
        create(GetMemoryRequestSchema, { includeEvidence }),
      );
      return {
        traits: resp.traits.map(toTraitView),
        personalizationEnabled: resp.personalizationEnabled,
        hasVector: resp.hasVector,
        signalCount: resp.signalCount,
        lastSignalAt: tsToMillis(resp.lastSignalAt),
        generatedAt: tsToMillis(resp.generatedAt),
      };
    },
    staleTime: 30_000,
  }));
}

/**
 * Removes a belief and the signals that produced it.
 *
 * Deleting the trait alone would be undone by the next recompute, so this also
 * removes the underlying feedback. Returns how many signals went with it.
 */
export function useForgetTrait() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (traitKey: string): Promise<number> => {
      const resp = await memoryClient.forgetTrait(create(ForgetTraitRequestSchema, { traitKey }));
      return resp.signalsRemoved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryQueryKey });
    },
  }));
}

/**
 * Removes one recorded action, leaving an otherwise accurate belief intact.
 */
export function useForgetEvidence() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (feedbackId: string): Promise<void> => {
      await memoryClient.forgetEvidence(create(ForgetEvidenceRequestSchema, { feedbackId }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryQueryKey });
    },
  }));
}

/** Human-readable description of what an action was. */
export function describeEvent(event: string): string {
  switch (event) {
    case "saved":
      return "saved";
    case "favorited":
      return "favourited";
    case "visited":
      return "visited";
    case "skipped":
      return "skipped";
    case "reordered":
      return "moved in a plan";
    case "exported":
      return "exported";
    default:
      return event;
  }
}
