// Signed-in devices - RPC version
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  AuthService,
  ListSessionsRequestSchema,
  RevokeSessionRequestSchema,
  RevokeOtherSessionsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import { transport } from "../connect-transport";
import { getRefreshToken } from "../auth/tokens";
import { queryKeys } from "./shared";
import { useAppQuery } from "./authed-query";

const authClient = createClient(AuthService, transport);

// protobuf-es Timestamps carry seconds/nanos, not a toDate method — calling
// `.toDate?.()` on one silently yields undefined rather than failing.
function toDate(ts?: { seconds: bigint; nanos: number }): Date | undefined {
  if (!ts) return undefined;
  return new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000));
}

/**
 * One place the account is signed in.
 *
 * user_sessions has recorded the user agent and IP since the table was created
 * and nothing ever read them back, so there was no way to see where an account
 * was signed in or to end a session.
 */
export type DeviceSession = {
  id: string;
  userAgent?: string;
  clientIp?: string;
  createdAt?: Date;
  expiresAt?: Date;
  /** The session making this request. Never revoke it by accident. */
  current: boolean;
};

export const useSessions = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.sessions,
    queryFn: async (): Promise<DeviceSession[]> => {
      // Sent so the server can mark which row is this device. Access tokens are
      // stateless JWTs with nothing mapping back to a session, so without the
      // refresh token nothing can be marked current.
      const response = await authClient.listSessions(
        create(ListSessionsRequestSchema, { refreshToken: getRefreshToken() ?? undefined }),
      );
      return (response.sessions || []).map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        clientIp: session.clientIp,
        createdAt: toDate(session.createdAt),
        expiresAt: toDate(session.expiresAt),
        current: session.current,
      }));
    },
    staleTime: 30 * 1000,
  }));
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (sessionId: string) => {
      const response = await authClient.revokeSession(
        create(RevokeSessionRequestSchema, { sessionId }),
      );
      return { success: response.success, message: response.message };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  }));
};

export const useRevokeOtherSessions = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async () => {
      // Required, not optional. Without it the server cannot tell which session
      // to spare and refuses rather than guessing — guessing wrong signs you
      // out of the device in your hand.
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error("Sign in again before signing out your other devices.");
      }
      const response = await authClient.revokeOtherSessions(
        create(RevokeOtherSessionsRequestSchema, { refreshToken }),
      );
      return { success: response.success, message: response.message };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  }));
};
