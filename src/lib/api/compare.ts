// Weekend city compare — CompareService client.
import { useMutation } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  CompareService,
  CompareWeekendRequestSchema,
  type CompareWeekendResponse,
  type CityCompareColumn,
  CompareRecommendation,
} from "@buf/loci_loci-proto.bufbuild_es/loci/compare/v1/compare_pb.js";
import { transport } from "../connect-transport";

const client = createClient(CompareService, transport);

export type { CompareWeekendResponse, CityCompareColumn, CompareRecommendation };

export interface CompareWeekendInput {
  originCity?: string;
  originLat?: number;
  originLon?: number;
  candidates: string[];
  startDate: Date;
  endDate: Date;
  profileId?: string;
}

export async function compareWeekend(input: CompareWeekendInput): Promise<CompareWeekendResponse> {
  return client.compareWeekend(
    create(CompareWeekendRequestSchema, {
      originCity: input.originCity,
      originLat: input.originLat,
      originLon: input.originLon,
      candidateCityNames: input.candidates,
      startDate: timestampFromDate(input.startDate),
      endDate: timestampFromDate(input.endDate),
      profileId: input.profileId,
    }),
  );
}

export const useCompareWeekendMutation = () =>
  useMutation(() => ({
    mutationFn: compareWeekend,
  }));

export const recommendationLabel = (rec: CompareRecommendation, columns: CityCompareColumn[]) => {
  switch (rec) {
    case CompareRecommendation.FIRST:
      return columns[0]?.cityName ? `Pick ${columns[0].cityName}` : "Pick first city";
    case CompareRecommendation.SECOND:
      return columns[1]?.cityName ? `Pick ${columns[1].cityName}` : "Pick second city";
    case CompareRecommendation.BOTH:
      return "Do both cities";
    default:
      return "Compare";
  }
};
