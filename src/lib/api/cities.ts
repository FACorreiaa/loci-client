// Cities API functions - Using RPC
import { useQuery } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  CityService,
  SearchCitiesRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/city/city_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import { useAppQuery } from "./authed-query";

const cityClient = createClient(CityService, transport);

// City type based on the backend CityDetail type
export interface City {
  id: string;
  name: string;
  country: string;
  state_province?: string;
  ai_summary: string;
  center_latitude?: number;
  center_longitude?: number;
}

// City with coordinates (simplified for frontend use)
export interface CityWithCoordinates {
  id: string;
  label: string;
  lat: number | null;
  lon: number | null;
}

// Helper to map proto to client type
const mapProtoToCity = (proto: any): City => ({
  id: proto.id,
  name: proto.name,
  country: proto.country,
  state_province: proto.stateProvince,
  ai_summary: proto.aiSummary || "",
  center_latitude: proto.centerLatitude,
  center_longitude: proto.centerLongitude,
});

// ===============
// CITY QUERIES (RPC)
// ===============

// Get all cities from database via RPC
export const getCities = async (): Promise<City[]> => {
  const request = create(SearchCitiesRequestSchema, { query: "" });
  const response = await cityClient.searchCities(request);
  return (response.cities || []).map(mapProtoToCity);
};

// React Query hook for getting all cities
export const useCities = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.cities,
    queryFn: getCities,
    staleTime: 30 * 60 * 1000, // Cities don't change often, cache for 30 minutes
  }));
};

// Helper function to convert backend cities to frontend format
export const convertCitiesToDropdownFormat = (cities: City[]): CityWithCoordinates[] => {
  const frontendCities: CityWithCoordinates[] = [
    { id: "all", label: "All Cities", lat: null, lon: null },
  ];

  cities.forEach((city) => {
    frontendCities.push({
      id: city.name.toLowerCase().replace(/\s+/g, "-"),
      label: city.name,
      lat: city.center_latitude || null,
      lon: city.center_longitude || null,
    });
  });

  return frontendCities;
};
