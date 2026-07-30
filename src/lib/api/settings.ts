import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
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
        await updateSearchProfile.mutateAsync({ profileId, data: settings });
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
