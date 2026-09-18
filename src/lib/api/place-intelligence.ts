import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  ConfirmPlaceRequestSchema,
  GetMyContributorProfileRequestSchema,
  GetPlaceFactsRequestSchema,
  ListPendingPlacesRequestSchema,
  ListVerificationTasksRequestSchema,
  PlaceClaimStatus as ProtoPlaceClaimStatus,
  PlaceFactField as ProtoPlaceFactField,
  PlaceIntelligenceService,
  PlaceSubmissionStatus as ProtoPlaceSubmissionStatus,
  SubmitPlaceClaimRequestSchema,
  SubmitPlaceRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/place/place_intelligence_pb.js";
import { createClient } from "@connectrpc/connect";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { transport } from "~/lib/connect-transport";
import { useAppQuery } from "./authed-query";

const placeClient = createClient(PlaceIntelligenceService, transport);

export type PlaceFactField =
  | "PLACE_FACT_FIELD_OPENING_HOURS"
  | "PLACE_FACT_FIELD_PRICE_LEVEL"
  | "PLACE_FACT_FIELD_ACCESSIBILITY"
  | "PLACE_FACT_FIELD_DIETARY"
  | "PLACE_FACT_FIELD_CROWD_LEVEL"
  | "PLACE_FACT_FIELD_NOISE_LEVEL"
  | "PLACE_FACT_FIELD_CHILD_FRIENDLY"
  | "PLACE_FACT_FIELD_DOG_FRIENDLY"
  | "PLACE_FACT_FIELD_VIBE";

export interface VerificationTask {
  poiId: string;
  poiName: string;
  requestedFields: PlaceFactField[];
  oldestFactAt?: string;
}

export interface ContributorProfile {
  reputation: number;
  submittedClaims: number;
  acceptedClaims: number;
  badges: string[];
}

/**
 * What became of a submitted claim.
 *
 * A report does not go live on its own: it waits as PENDING until a second
 * scout independently reports the same thing. Surfacing that distinction is the
 * difference between "nothing happened" and "one more look needed".
 */
export type ClaimStatus = "UNSPECIFIED" | "PENDING" | "ACCEPTED" | "CONTRADICTED" | "EXPIRED";

export interface SubmitClaimResult {
  claimId: string;
  status: ClaimStatus;
}

const claimStatuses: Record<ClaimStatus, ProtoPlaceClaimStatus> = {
  UNSPECIFIED: ProtoPlaceClaimStatus.UNSPECIFIED,
  PENDING: ProtoPlaceClaimStatus.PENDING,
  ACCEPTED: ProtoPlaceClaimStatus.ACCEPTED,
  CONTRADICTED: ProtoPlaceClaimStatus.CONTRADICTED,
  EXPIRED: ProtoPlaceClaimStatus.EXPIRED,
};

const claimStatusNames = Object.fromEntries(
  Object.entries(claimStatuses).map(([name, value]) => [value, name]),
) as Record<ProtoPlaceClaimStatus, ClaimStatus>;

const fields: Record<PlaceFactField, ProtoPlaceFactField> = {
  PLACE_FACT_FIELD_OPENING_HOURS: ProtoPlaceFactField.OPENING_HOURS,
  PLACE_FACT_FIELD_PRICE_LEVEL: ProtoPlaceFactField.PRICE_LEVEL,
  PLACE_FACT_FIELD_ACCESSIBILITY: ProtoPlaceFactField.ACCESSIBILITY,
  PLACE_FACT_FIELD_DIETARY: ProtoPlaceFactField.DIETARY,
  PLACE_FACT_FIELD_CROWD_LEVEL: ProtoPlaceFactField.CROWD_LEVEL,
  PLACE_FACT_FIELD_NOISE_LEVEL: ProtoPlaceFactField.NOISE_LEVEL,
  PLACE_FACT_FIELD_CHILD_FRIENDLY: ProtoPlaceFactField.CHILD_FRIENDLY,
  PLACE_FACT_FIELD_DOG_FRIENDLY: ProtoPlaceFactField.DOG_FRIENDLY,
  PLACE_FACT_FIELD_VIBE: ProtoPlaceFactField.VIBE,
};

const fieldNames = Object.fromEntries(
  Object.entries(fields).map(([name, value]) => [value, name]),
) as Record<ProtoPlaceFactField, PlaceFactField>;

/** Options shared by the read hooks, so a signed-out visit fires no doomed RPC. */
export interface PlaceIntelligenceQueryOptions {
  enabled?: () => boolean;
}

/**
 * A fact the crowd has established about a place.
 *
 * `contributorCount` is the whole story: one scout is a report that is waiting,
 * two or more is something the field guide stands behind. The same threshold
 * governs the server's promotion rule and what the generator is told, so the
 * three never disagree.
 */
export interface PlaceFact {
  field: PlaceFactField;
  value: string;
  confidence: number;
  contributorCount: number;
  verifiedAt?: string;
}

export const CLAIMS_REQUIRED_FOR_VERIFICATION = 2;

export const isVerifiedFact = (fact: PlaceFact) =>
  fact.contributorCount >= CLAIMS_REQUIRED_FOR_VERIFICATION;

/**
 * What scouts have confirmed about one place.
 *
 * The RPC has existed since the contribution flow was built and nothing called
 * it, so contributions were invisible to everyone except the generator.
 */
export const useGetPlaceFacts = (
  poiId: () => string | undefined,
  options: PlaceIntelligenceQueryOptions = {},
) =>
  useAppQuery(() => ({
    enabled: Boolean(poiId()) && (options.enabled ? options.enabled() : true),
    queryKey: ["place-intelligence", "facts", poiId()],
    queryFn: async (): Promise<PlaceFact[]> => {
      const response = await placeClient.getPlaceFacts(
        create(GetPlaceFactsRequestSchema, { poiId: poiId() as string }),
      );
      const facts: PlaceFact[] = [];
      for (const fact of response.facts) {
        const field = fieldNames[fact.field];
        // A field this client does not know about is dropped rather than
        // rendered as a raw enum name — the server may be ahead of the bundle.
        if (!field) continue;
        facts.push({
          field,
          value: fact.value,
          confidence: fact.confidence,
          contributorCount: fact.contributorCount,
          verifiedAt: fact.verifiedAt ? timestampDate(fact.verifiedAt).toISOString() : undefined,
        });
      }
      return facts;
    },
  }));

export const useVerificationTasks = (options: PlaceIntelligenceQueryOptions = {}) =>
  useAppQuery(() => ({
    enabled: options.enabled ? options.enabled() : true,
    queryKey: ["place-intelligence", "tasks"],
    queryFn: async (): Promise<VerificationTask[]> => {
      const response = await placeClient.listVerificationTasks(
        create(ListVerificationTasksRequestSchema, { limit: 40 }),
      );
      return response.tasks.map((task) => ({
        poiId: task.poiId,
        poiName: task.poiName,
        requestedFields: task.requestedFields
          .map((field) => fieldNames[field])
          .filter((field): field is PlaceFactField => Boolean(field)),
        oldestFactAt: task.oldestFactAt
          ? timestampDate(task.oldestFactAt).toISOString()
          : undefined,
      }));
    },
  }));

export const useContributorProfile = (options: PlaceIntelligenceQueryOptions = {}) =>
  useAppQuery(() => ({
    enabled: options.enabled ? options.enabled() : true,
    queryKey: ["place-intelligence", "profile"],
    queryFn: async (): Promise<ContributorProfile> => {
      const profile = await placeClient.getMyContributorProfile(
        create(GetMyContributorProfileRequestSchema, {}),
      );
      return {
        reputation: profile.reputation,
        submittedClaims: profile.submittedClaims,
        acceptedClaims: profile.acceptedClaims,
        badges: profile.badges,
      };
    },
  }));

/**
 * Files every answer in a selection, each as its own claim.
 *
 * A multi-answer field sends one claim per answer so that each is corroborated
 * on its own; a single-answer field is the degenerate case of one. The reported
 * status is the best any of them reached, because that is what the scout is
 * being told about the report they just made.
 */
export const useSubmitPlaceClaims = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (claim: {
      poiId: string;
      field: PlaceFactField;
      values: string[];
    }): Promise<SubmitClaimResult> => {
      const results = await Promise.all(
        claim.values.map(async (value) => {
          const response = await placeClient.submitPlaceClaim(
            create(SubmitPlaceClaimRequestSchema, {
              clientClaimId: crypto.randomUUID(),
              observedAt: timestampFromDate(new Date()),
              poiId: claim.poiId,
              field: fields[claim.field],
              value,
            }),
          );
          return {
            claimId: response.claimId,
            status: claimStatusNames[response.status] ?? "UNSPECIFIED",
          } satisfies SubmitClaimResult;
        }),
      );

      const best =
        results.find((result) => result.status === "ACCEPTED") ??
        results.find((result) => result.status === "PENDING") ??
        results[0];
      return best ?? { claimId: "", status: "UNSPECIFIED" };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-intelligence"] }),
  }));
};

export interface PendingPlace {
  submissionId: string;
  name: string;
  cityName: string;
  category?: string;
  address?: string;
  confirmationsNeeded: number;
}

/** Places somebody else has proposed, waiting on a second pair of eyes. */
export const usePendingPlaces = (options: PlaceIntelligenceQueryOptions = {}) =>
  useAppQuery(() => ({
    enabled: options.enabled ? options.enabled() : true,
    queryKey: ["place-intelligence", "pending-places"],
    queryFn: async (): Promise<PendingPlace[]> => {
      const response = await placeClient.listPendingPlaces(
        create(ListPendingPlacesRequestSchema, { limit: 20 }),
      );
      return response.places.map((place) => ({
        submissionId: place.submissionId,
        name: place.name,
        cityName: place.cityName,
        category: place.category,
        address: place.address,
        confirmationsNeeded: place.confirmationsNeeded,
      }));
    },
  }));

export const useSubmitPlace = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (place: {
      name: string;
      cityName: string;
      country?: string;
      category?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
      website?: string;
    }) => {
      const response = await placeClient.submitPlace(
        create(SubmitPlaceRequestSchema, {
          clientSubmissionId: crypto.randomUUID(),
          ...place,
        }),
      );
      return {
        submissionId: response.submissionId,
        confirmationsNeeded: response.confirmationsNeeded,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-intelligence"] }),
  }));
};

export const useConfirmPlace = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (submissionId: string) => {
      const response = await placeClient.confirmPlace(
        create(ConfirmPlaceRequestSchema, { submissionId }),
      );
      return {
        promoted: response.status === ProtoPlaceSubmissionStatus.ACCEPTED,
        confirmationsNeeded: response.confirmationsNeeded,
        poiId: response.poiId,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-intelligence"] }),
  }));
};

export const useSubmitPlaceClaim = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (claim: {
      poiId: string;
      field: PlaceFactField;
      value: string;
    }): Promise<SubmitClaimResult> => {
      const response = await placeClient.submitPlaceClaim(
        create(SubmitPlaceClaimRequestSchema, {
          clientClaimId: crypto.randomUUID(),
          observedAt: timestampFromDate(new Date()),
          poiId: claim.poiId,
          field: fields[claim.field],
          value: claim.value,
        }),
      );
      // The response used to be thrown away, which is why every submit looked
      // identical whether it was still waiting on a second scout or had just
      // gone live.
      return {
        claimId: response.claimId,
        status: claimStatusNames[response.status] ?? "UNSPECIFIED",
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-intelligence"] }),
  }));
};
