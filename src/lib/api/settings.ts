import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { queryKeys } from "./shared";
import { fetchPreferenceProfilesRPC, useUpdateSearchProfileMutation } from "./profiles";
import { useUserProfileQuery, useUpdateProfileMutation } from "./user";
import { useAppQuery } from "./authed-query";

// ==================
// SETTINGS QUERIES - STUB
// ==================

export const useSettings = () => {
  const userProfile = useUserProfileQuery();

  return useAppQuery(() => ({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const profiles = await fetchPreferenceProfilesRPC();
      return {
        profile: userProfile.data || null,
        preferenceProfiles: profiles,
      };
    },
    staleTime: 10 * 60 * 1000,
  }));
};

export const useUpdateSettingsMutation = () => {
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfileMutation();
  const updateSearchProfile = useUpdateSearchProfileMutation();

  return useMutation(() => ({
    mutationFn: async ({ profileId, settings }: { profileId: string; settings: any }) => {
      if (profileId) {
        // An update replaces the list-valued fields rather than merging them --
        // a proto3 `repeated` field cannot distinguish "omitted" from "the user
        // cleared it", so the server treats the request as the new truth. A
        // partial caller must therefore send the lists it wants to keep, which
        // is what merging over the current profile does here.
        const current = (await fetchPreferenceProfilesRPC()).find((p) => p.id === profileId);
        const data = current
          ? {
              profile_name: current.profile_name,
              is_default: current.is_default,
              search_radius_km: current.search_radius_km,
              preferred_time: current.preferred_time,
              budget_level: current.budget_level,
              preferred_pace: current.preferred_pace,
              prefer_accessible_pois: current.prefer_accessible_pois,
              prefer_outdoor_seating: current.prefer_outdoor_seating,
              prefer_dog_friendly: current.prefer_dog_friendly,
              preferred_vibes: current.preferred_vibes,
              preferred_transport: current.preferred_transport,
              dietary_needs: current.dietary_needs,
              interests: (current.interests ?? []).map((i) => i.id),
              tags: (current.tags ?? []).map((t) => t.id),
              accommodation_preferences: current.accommodation_preferences ?? undefined,
              dining_preferences: current.dining_preferences ?? undefined,
              activity_preferences: current.activity_preferences ?? undefined,
              itinerary_preferences: current.itinerary_preferences ?? undefined,
              ...settings,
            }
          : settings;
        await updateSearchProfile.mutateAsync({ profileId, data });
      } else {
        await updateProfile.mutateAsync(settings);
      }
      return { success: true };
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSettings(profileId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  }));
};
