import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  GetMyContributorProfileRequestSchema,
  ListVerificationTasksRequestSchema,
  PlaceFactField as ProtoPlaceFactField,
  PlaceIntelligenceService,
  SubmitPlaceClaimRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/place/place_intelligence_pb.js";
import { createClient } from "@connectrpc/connect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
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

export const useVerificationTasks = () =>
  useAppQuery(() => ({
    queryKey: ["place-intelligence", "tasks"],
    queryFn: async (): Promise<VerificationTask[]> => {
      const response = await placeClient.listVerificationTasks(
        create(ListVerificationTasksRequestSchema, { limit: 20 }),
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

export const useContributorProfile = () =>
  useAppQuery(() => ({
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

export const useSubmitPlaceClaim = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: (claim: { poiId: string; field: PlaceFactField; value: string }) =>
      placeClient.submitPlaceClaim(
        create(SubmitPlaceClaimRequestSchema, {
          clientClaimId: crypto.randomUUID(),
          observedAt: timestampFromDate(new Date()),
          poiId: claim.poiId,
          field: fields[claim.field],
          value: claim.value,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-intelligence"] }),
  }));
};
