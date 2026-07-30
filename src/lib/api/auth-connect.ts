// Connect RPC authentication using plain Connect client with Solid Query
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { AuthService } from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  ValidateSessionRequestSchema,
  LogoutRequestSchema,
  RefreshTokenRequestSchema,
  ChangePasswordRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import { clearAuthToken, getAuthToken, getRefreshToken, setAuthToken } from "../auth/tokens";
import { queryKeys } from "./shared";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

// Create the auth service client
const authClient = createClient(AuthService, transport);

// =======================
// AUTHENTICATION QUERIES
// =======================

export const useValidateSession = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.session,
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) {
        return { valid: false };
      }

      const request = create(ValidateSessionRequestSchema, {
        sessionId: token,
      });

      const response = await authClient.validateSession(request);

      // Convert to match existing interface
      return {
        valid: response.valid,
        user_id: response.userId,
        username: response.username,
        email: response.email,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    enabled: !!getAuthToken(), // Only run if token exists
  }));
};

// =======================
// AUTHENTICATION MUTATIONS
// =======================

export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({
      email,
      password,
      rememberMe = false,
    }: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      const request = create(LoginRequestSchema, {
        email,
        password,
      });

      const response = await authClient.login(request);

      // Store tokens
      setAuthToken(response.accessToken, rememberMe, response.refreshToken);

      return {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
        message: response.message,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  }));
};

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({
      username,
      email,
      password,
      role = "user",
    }: {
      username: string;
      email: string;
      password: string;
      role?: string;
    }) => {
      const request = create(RegisterRequestSchema, {
        username,
        email,
        password,
        role,
      });

      const response = await authClient.register(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  }));
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available for logout");
      }

      const request = create(LogoutRequestSchema, {
        refreshToken,
      });

      const response = await authClient.logout(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
    onSettled: async () => {
      clearAuthToken();
      queryClient.clear(); // Clear all cached data on logout
    },
  }));
};

export const useUpdatePasswordMutation = () => {
  return useMutation(() => ({
    mutationFn: async ({
      oldPassword,
      newPassword,
    }: {
      oldPassword: string;
      newPassword: string;
    }) => {
      const request = create(ChangePasswordRequestSchema, {
        oldPassword,
        newPassword,
      });

      const response = await authClient.changePassword(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
  }));
};

// Optional: Add refresh token mutation for manual token refresh
export const useRefreshTokenMutation = () => {
  return useMutation(() => ({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const request = create(RefreshTokenRequestSchema, {
        refreshToken,
      });

      const response = await authClient.refreshToken(request);

      // Update stored tokens
      setAuthToken(response.accessToken, true, response.refreshToken);

      return {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
      };
    },
  }));
};

// Forgot Password - initiates password reset flow
export const useForgotPasswordMutation = () => {
  return useMutation(() => ({
    mutationFn: async ({ email }: { email: string }) => {
      const { ForgotPasswordRequestSchema } =
        await import("@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js");

      const request = create(ForgotPasswordRequestSchema, {
        email,
      });

      const response = await authClient.forgotPassword(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
  }));
};

// Reset Password - completes password reset with token
export const useResetPasswordMutation = () => {
  return useMutation(() => ({
    mutationFn: async ({ token, newPassword }: { token: string; newPassword: string }) => {
      const { ResetPasswordRequestSchema } =
        await import("@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js");

      const request = create(ResetPasswordRequestSchema, {
        token,
        newPassword,
      });

      const response = await authClient.resetPassword(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
  }));
};
