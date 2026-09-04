// Search Profile queries and mutations - Using RPC
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ProfileService,
  GetUserPreferenceProfilesRequestSchema,
  GetUserPreferenceProfileRequestSchema,
  CreateUserPreferenceProfileRequestSchema,
  UpdateUserPreferenceProfileRequestSchema,
  DeleteUserPreferenceProfileRequestSchema,
  SetDefaultProfileRequestSchema,
  GetDomainPreferencesRequestSchema,
  GetCombinedFiltersRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import { getAuthToken } from "../api";
import type {
  SearchProfile,
  TravelProfileFormData,
  AccommodationPreferences,
  DiningPreferences,
  ActivityPreferences,
  ItineraryPreferences,
} from "./types";
import { useAppQuery } from "./authed-query";

const profileClient = createClient(ProfileService, transport);

const mapProtoToSearchProfile = (profile: any): SearchProfile => ({
  id: profile.id,
  user_id: profile.userId,
  profile_name: profile.profileName,
  is_default: profile.isDefault ?? false,
  search_radius_km: profile.searchRadiusKm ?? 0,
  preferred_time: profile.preferredTime ?? "DAY_PREFERENCE_ANY",
  budget_level: profile.budgetLevel ?? 0,
  preferred_pace: profile.preferredPace ?? "SEARCH_PACE_ANY",
  prefer_accessible_pois: profile.preferAccessiblePois ?? false,
  prefer_outdoor_seating: profile.preferOutdoorSeating ?? false,
  prefer_dog_friendly: profile.preferDogFriendly ?? false,
  preferred_vibes: profile.preferredVibes || [],
  preferred_transport: profile.preferredTransport ?? "TRANSPORT_PREFERENCE_ANY",
  dietary_needs: profile.dietaryNeeds || [],
  interests: profile.interests || null,
  tags: profile.tags || null,
  user_latitude: profile.userLatitude || null,
  user_longitude: profile.userLongitude || null,
  created_at: profile.createdAt?.toDate?.()?.toISOString() || "",
  updated_at: profile.updatedAt?.toDate?.()?.toISOString() || "",
});

const mapProtoToAccommodationPreferences = (prefs: any): AccommodationPreferences => ({
  accommodation_type: prefs?.accommodationType || [],
  star_rating: prefs?.starRating
    ? { min: prefs.starRating.min || 0, max: prefs.starRating.max || 5 }
    : { min: 0, max: 5 },
  price_range_per_night: prefs?.priceRangePerNight
    ? { min: prefs.priceRangePerNight.min || 0, max: prefs.priceRangePerNight.max || 1000 }
    : { min: 0, max: 1000 },
  amenities: prefs?.amenities || [],
  room_type: prefs?.roomType || [],
  chain_preference: prefs?.chainPreference || "",
  cancellation_policy: prefs?.cancellationPolicy || [],
  booking_flexibility: prefs?.bookingFlexibility || "",
});

const mapProtoToDiningPreferences = (prefs: any): DiningPreferences => ({
  cuisine_types: prefs?.cuisineTypes || [],
  meal_types: prefs?.mealTypes || [],
  service_style: prefs?.serviceStyle || [],
  price_range_per_person: prefs?.priceRangePerPerson
    ? { min: prefs.priceRangePerPerson.min || 0, max: prefs.priceRangePerPerson.max || 100 }
    : { min: 0, max: 100 },
  dietary_needs: prefs?.dietaryNeeds || [],
  allergen_free: prefs?.allergenFree || [],
  michelin_rated: prefs?.michelinRated || false,
  local_recommendations: prefs?.localRecommendations || false,
  chain_vs_local: prefs?.chainVsLocal || "",
  organic_preference: prefs?.organicPreference || false,
  outdoor_seating_preferred: prefs?.outdoorSeatingPreferred || false,
});

const mapProtoToActivityPreferences = (prefs: any): ActivityPreferences => ({
  activity_categories: prefs?.activityCategories || [],
  physical_activity_level: prefs?.physicalActivityLevel || "",
  indoor_outdoor_preference: prefs?.indoorOutdoorPreference || "",
  cultural_immersion_level: prefs?.culturalImmersionLevel || "",
  must_see_vs_hidden_gems: prefs?.mustSeeVsHiddenGems || "",
  educational_preference: prefs?.educationalPreference || false,
  photography_opportunities: prefs?.photographyOpportunities || false,
  season_specific_activities: prefs?.seasonSpecificActivities || [],
  avoid_crowds: prefs?.avoidCrowds || false,
  local_events_interest: prefs?.localEventsInterest || [],
});

const mapProtoToItineraryPreferences = (prefs: any): ItineraryPreferences => ({
  planning_style: prefs?.planningStyle || "",
  preferred_pace: prefs?.preferredPace || "",
  time_flexibility: prefs?.timeFlexibility || "",
  morning_vs_evening: prefs?.morningVsEvening || "",
  weekend_vs_weekday: prefs?.weekendVsWeekday || "",
  preferred_seasons: prefs?.preferredSeasons || [],
  avoid_peak_season: prefs?.avoidPeakSeason || false,
  adventure_vs_relaxation: prefs?.adventureVsRelaxation || "",
  spontaneous_vs_planned: prefs?.spontaneousVsPlanned || "",
});

// ==================
// DIRECT FETCH FUNCTIONS (for use outside React)
// ==================

// Fetch all preference profiles directly (RPC)
export const fetchPreferenceProfilesRPC = async (): Promise<SearchProfile[]> => {
  const request = create(GetUserPreferenceProfilesRequestSchema, {});
  const response = await profileClient.getUserPreferenceProfiles(request);
  return (response.profiles || []).map(mapProtoToSearchProfile);
};

// ==================
// SEARCH PROFILE QUERIES (RPC)
// ==================

// Get all search profiles for the user
export const useSearchProfiles = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.profiles,
    queryFn: async (): Promise<SearchProfile[]> => {
      const request = create(GetUserPreferenceProfilesRequestSchema, {});
      const response = await profileClient.getUserPreferenceProfiles(request);
      return (response.profiles || []).map(mapProtoToSearchProfile);
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!getAuthToken(),
  }));
};

// Get a specific search profile
export const useSearchProfile = (profileId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.profile(profileId),
    queryFn: async (): Promise<SearchProfile> => {
      const request = create(GetUserPreferenceProfileRequestSchema, { profileId });
      const response = await profileClient.getUserPreferenceProfile(request);
      return mapProtoToSearchProfile(response.profile);
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// Get the default search profile
export const useDefaultSearchProfile = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.defaultProfile,
    queryFn: async (): Promise<SearchProfile | undefined> => {
      const request = create(GetUserPreferenceProfilesRequestSchema, {});
      const response = await profileClient.getUserPreferenceProfiles(request);
      const profiles = (response.profiles || []).map(mapProtoToSearchProfile);
      return profiles.find((p) => p.is_default) || profiles[0];
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!getAuthToken(),
  }));
};

// ==================
// DOMAIN-SPECIFIC PREFERENCE QUERIES (RPC)
// ==================

// Get accommodation preferences for a profile
export const useAccommodationPreferences = (profileId: string) => {
  return useAppQuery(() => ({
    queryKey: ["profiles", profileId, "accommodation"],
    queryFn: async (): Promise<AccommodationPreferences> => {
      const request = create(GetDomainPreferencesRequestSchema, { profileId });
      const response = await profileClient.getAccommodationPreferences(request);
      return mapProtoToAccommodationPreferences(response.preferences);
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// Get dining preferences for a profile
export const useDiningPreferences = (profileId: string) => {
  return useAppQuery(() => ({
    queryKey: ["profiles", profileId, "dining"],
    queryFn: async (): Promise<DiningPreferences> => {
      const request = create(GetDomainPreferencesRequestSchema, { profileId });
      const response = await profileClient.getDiningPreferences(request);
      return mapProtoToDiningPreferences(response.preferences);
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// Get activity preferences for a profile
export const useActivityPreferences = (profileId: string) => {
  return useAppQuery(() => ({
    queryKey: ["profiles", profileId, "activities"],
    queryFn: async (): Promise<ActivityPreferences> => {
      const request = create(GetDomainPreferencesRequestSchema, { profileId });
      const response = await profileClient.getActivityPreferences(request);
      return mapProtoToActivityPreferences(response.preferences);
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// Get itinerary preferences for a profile
export const useItineraryPreferences = (profileId: string) => {
  return useAppQuery(() => ({
    queryKey: ["profiles", profileId, "itinerary"],
    queryFn: async (): Promise<ItineraryPreferences> => {
      const request = create(GetDomainPreferencesRequestSchema, { profileId });
      const response = await profileClient.getItineraryPreferences(request);
      return mapProtoToItineraryPreferences(response.preferences);
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// Get combined filters for a domain
export const useCombinedFilters = (profileId: string, domain?: string) => {
  return useAppQuery(() => ({
    queryKey: ["profiles", profileId, "filters", domain || "general"],
    queryFn: async () => {
      const request = create(GetCombinedFiltersRequestSchema, { profileId, domain });
      const response = await profileClient.getCombinedFilters(request);
      return {
        profile: response.profile ? mapProtoToSearchProfile(response.profile) : null,
        accommodation: response.accommodation
          ? mapProtoToAccommodationPreferences(response.accommodation)
          : null,
        dining: response.dining ? mapProtoToDiningPreferences(response.dining) : null,
        activity: response.activity ? mapProtoToActivityPreferences(response.activity) : null,
        itinerary: response.itinerary ? mapProtoToItineraryPreferences(response.itinerary) : null,
      };
    },
    enabled: !!profileId && !!getAuthToken(),
    staleTime: 10 * 60 * 1000,
  }));
};

// ==================
// SEARCH PROFILE MUTATIONS (RPC)
// ==================

// Create a new search profile
export const useCreateSearchProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (data: Partial<TravelProfileFormData>) => {
      const request = create(CreateUserPreferenceProfileRequestSchema, {
        profileName: data.profile_name || "New Profile",
        isDefault: data.is_default,
        searchRadiusKm: data.search_radius_km,
        budgetLevel: data.budget_level,
        preferAccessiblePois: data.prefer_accessible_pois,
        preferOutdoorSeating: data.prefer_outdoor_seating,
        preferDogFriendly: data.prefer_dog_friendly,
        preferredVibes: data.preferred_vibes || [],
        dietaryNeeds: data.dietary_needs || [],
        tagIds: data.tags || [],
        interestIds: data.interests || [],
      });
      const response = await profileClient.createUserPreferenceProfile(request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.defaultProfile });
    },
  }));
};

// Update a search profile
export const useUpdateSearchProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({
      profileId,
      data,
    }: {
      profileId: string;
      data: Partial<TravelProfileFormData>;
    }) => {
      const request = create(UpdateUserPreferenceProfileRequestSchema, {
        profileId,
        profileName: data.profile_name,
        isDefault: data.is_default,
        searchRadiusKm: data.search_radius_km,
        budgetLevel: data.budget_level,
        preferAccessiblePois: data.prefer_accessible_pois,
        preferOutdoorSeating: data.prefer_outdoor_seating,
        preferDogFriendly: data.prefer_dog_friendly,
        preferredVibes: data.preferred_vibes || [],
        dietaryNeeds: data.dietary_needs || [],
        tagIds: data.tags || [],
        interestIds: data.interests || [],
      });
      const response = await profileClient.updateUserPreferenceProfile(request);
      return response;
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(profileId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.defaultProfile });
    },
  }));
};

// Delete a search profile
export const useDeleteSearchProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (profileId: string) => {
      const request = create(DeleteUserPreferenceProfileRequestSchema, { profileId });
      const response = await profileClient.deleteUserPreferenceProfile(request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.defaultProfile });
    },
  }));
};

// Set a search profile as default
export const useSetDefaultProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (profileId: string) => {
      const request = create(SetDefaultProfileRequestSchema, { profileId });
      const response = await profileClient.setDefaultProfile(request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.defaultProfile });
    },
  }));
};
