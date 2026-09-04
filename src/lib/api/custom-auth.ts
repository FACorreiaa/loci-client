// Connect RPC custom authentication (OAuth and Phone) using plain Connect client with Solid Query
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { CustomAuthService } from "@buf/loci_loci-proto.bufbuild_es/loci/custom_auth/custom_auth_pb.js";
import {
  GetOAuthURLRequestSchema,
  OAuthCallbackRequestSchema,
  SendPhoneVerificationRequestSchema,
  VerifyPhoneRequestSchema,
  OAuthProvider,
} from "@buf/loci_loci-proto.bufbuild_es/loci/custom_auth/custom_auth_pb.js";
import { setAuthToken } from "../auth/tokens";
import { queryKeys } from "./shared";
import { transport } from "../connect-transport";
import { identify } from "../analytics";

// Create the custom auth service client
const customAuthClient = createClient(CustomAuthService, transport);

// OAuth state storage for CSRF protection
let oauthStateStore: Record<string, string> = {};

// OAuth and phone providers return the server-issued user id. Keep PII on the
// person profile rather than adding it to authentication events.
function identifyAuthenticatedUser(user: { userId?: string; email?: string; username?: string }) {
  if (!user.userId) return;

  identify(user.userId, {
    ...(user.email ? { email: user.email } : {}),
    ...(user.username ? { name: user.username } : {}),
  });
}

/**
 * Opens a popup window for OAuth authentication
 */
function openOAuthPopup(url: string, title: string): Window | null {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  return window.open(url, title, `width=${width},height=${height},left=${left},top=${top},popup=1`);
}

/**
 * Waits for OAuth callback message from popup window
 */
function waitForOAuthCallback(
  popup: Window | null,
  _: string,
): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error("Failed to open popup window"));
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-callback") return;

      window.removeEventListener("message", handleMessage);
      clearInterval(checkClosed);
      popup.close();

      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }

      resolve({
        code: event.data.code,
        state: event.data.state,
      });
    };

    window.addEventListener("message", handleMessage);
  });
}

// ================
// GOOGLE LOGIN
// ================

export const useGoogleLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/auth/oauth-callback`;

      // Step 1: Get OAuth URL from server
      const request = create(GetOAuthURLRequestSchema, {
        provider: OAuthProvider.OAUTH_PROVIDER_GOOGLE,
        redirectUri,
      });

      const urlResponse = await customAuthClient.getOAuthURL(request);
      oauthStateStore["google"] = urlResponse.state;

      // Step 2: Open popup and wait for callback
      const popup = openOAuthPopup(urlResponse.authUrl, "Sign in with Google");
      const { code } = await waitForOAuthCallback(popup, "google");

      // Step 3: Exchange code for tokens
      const callbackRequest = create(OAuthCallbackRequestSchema, {
        provider: OAuthProvider.OAUTH_PROVIDER_GOOGLE,
        code,
        state: oauthStateStore["google"],
      });

      const response = await customAuthClient.oAuthCallback(callbackRequest);

      // Store tokens, then link the anonymous browser session to the stable id.
      setAuthToken(response.accessToken, true, response.refreshToken);
      identifyAuthenticatedUser(response);

      return {
        userId: response.userId,
        email: response.email,
        username: response.username,
        isNewUser: response.isNewUser,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  }));
};

// ================
// APPLE LOGIN
// ================

export const useAppleLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/auth/oauth-callback`;

      const request = create(GetOAuthURLRequestSchema, {
        provider: OAuthProvider.OAUTH_PROVIDER_APPLE,
        redirectUri,
      });

      const urlResponse = await customAuthClient.getOAuthURL(request);
      oauthStateStore["apple"] = urlResponse.state;

      const popup = openOAuthPopup(urlResponse.authUrl, "Sign in with Apple");
      const { code } = await waitForOAuthCallback(popup, "apple");

      const callbackRequest = create(OAuthCallbackRequestSchema, {
        provider: OAuthProvider.OAUTH_PROVIDER_APPLE,
        code,
        state: oauthStateStore["apple"],
      });

      const response = await customAuthClient.oAuthCallback(callbackRequest);

      setAuthToken(response.accessToken, true, response.refreshToken);
      identifyAuthenticatedUser(response);

      return {
        userId: response.userId,
        email: response.email,
        username: response.username,
        isNewUser: response.isNewUser,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  }));
};

// ================
// PHONE LOGIN
// ================

/**
 * Hook to send SMS verification code
 */
export const useSendPhoneVerificationMutation = () => {
  return useMutation(() => ({
    mutationFn: async ({ phoneNumber }: { phoneNumber: string }) => {
      const request = create(SendPhoneVerificationRequestSchema, {
        phoneNumber,
      });

      const response = await customAuthClient.sendPhoneVerification(request);

      return {
        success: response.success,
        message: response.message,
      };
    },
  }));
};

/**
 * Hook to verify phone code and authenticate
 */
export const useVerifyPhoneMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ phoneNumber, code }: { phoneNumber: string; code: string }) => {
      const request = create(VerifyPhoneRequestSchema, {
        phoneNumber,
        code,
      });

      const response = await customAuthClient.verifyPhone(request);

      // Store tokens, then identify with the server-issued stable user id.
      setAuthToken(response.accessToken, true, response.refreshToken);
      identifyAuthenticatedUser(response);

      return {
        userId: response.userId,
        isNewUser: response.isNewUser,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  }));
};
