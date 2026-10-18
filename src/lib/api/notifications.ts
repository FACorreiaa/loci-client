// Notification settings - RPC version
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  UserService,
  GetNotificationSettingsRequestSchema,
  UpdateNotificationSettingsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/user/user_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import { useAppQuery } from "./authed-query";

const userClient = createClient(UserService, transport);

/**
 * Notification switches, stored against the account.
 *
 * These used to live in localStorage keyed by user id, so they did not follow
 * anyone to a second browser or a phone, and nothing server-side could read
 * them — which meant nothing could ever act on them either.
 *
 * `searchFinished` is delivered as a web push (see ~/lib/push/push-client).
 * `recommendations` and `tripReminders` still only record a preference —
 * delivery for those is separate work that does not exist yet, so the UI
 * must not imply that either of them sends anything.
 *
 * `friendActivity` (friend requests and acceptances) is delivered the same
 * way as `searchFinished`: web push here, APNs on iOS.
 */
export type NotificationSettings = {
  recommendations: boolean;
  tripReminders: boolean;
  searchFinished: boolean;
  friendActivity: boolean;
};

export const useNotificationSettings = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.notificationSettings,
    queryFn: async (): Promise<NotificationSettings> => {
      const response = await userClient.getNotificationSettings(
        create(GetNotificationSettingsRequestSchema, {}),
      );
      return {
        recommendations: response.recommendations,
        tripReminders: response.tripReminders,
        searchFinished: response.searchFinished,
        friendActivity: response.friendActivity,
      };
    },
    staleTime: 5 * 60 * 1000,
  }));
};

export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    // Partial: send only the switch that moved. Omitting one means "leave it
    // as it is", which is not the same as turning it off.
    mutationFn: async (changes: Partial<NotificationSettings>): Promise<NotificationSettings> => {
      const response = await userClient.updateNotificationSettings(
        create(UpdateNotificationSettingsRequestSchema, {
          recommendations: changes.recommendations,
          tripReminders: changes.tripReminders,
          searchFinished: changes.searchFinished,
          friendActivity: changes.friendActivity,
        }),
      );
      return {
        recommendations: response.recommendations,
        tripReminders: response.tripReminders,
        searchFinished: response.searchFinished,
        friendActivity: response.friendActivity,
      };
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.notificationSettings, settings);
    },
  }));
};
