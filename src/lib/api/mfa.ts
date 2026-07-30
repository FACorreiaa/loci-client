// Two-factor authentication management: enrolment, recovery codes, and status.
//
// The login-time step-up lives in auth-connect.ts, because it is part of the
// login flow and runs before any token exists. Everything here needs a signed-in
// user.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  AuthService,
  BeginMFAEnrollmentRequestSchema,
  ConfirmMFAEnrollmentRequestSchema,
  DisableMFARequestSchema,
  RegenerateRecoveryCodesRequestSchema,
  GetMFAStatusRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const authClient = createClient(AuthService, transport);

export const mfaKeys = {
  status: ["mfa", "status"] as const,
};

export interface MFAStatus {
  enabled: boolean;
  /** How many single-use recovery codes are left. */
  recoveryCodesRemaining: number;
  enrolledAt: Date | null;
  /** True when the user's role cannot turn MFA off. */
  requiredByPolicy: boolean;
}

export interface MFAEnrollment {
  /** otpauth:// URI to render as a QR code. */
  provisioningUri: string;
  /** Base32 secret, for manual entry when a camera is unavailable. */
  secret: string;
}

/** The caller's current two-factor state. */
export const useMFAStatus = () =>
  useAppQuery<MFAStatus>(() => ({
    queryKey: mfaKeys.status,
    queryFn: async () => {
      const response = await authClient.getMFAStatus(create(GetMFAStatusRequestSchema, {}));

      return {
        enabled: response.enabled,
        recoveryCodesRemaining: response.recoveryCodesRemaining,
        enrolledAt: response.enrolledAt ? timestampToDate(response.enrolledAt) : null,
        requiredByPolicy: response.requiredByPolicy,
      };
    },
    // Security state, so it is worth being current: a stale "off" would hide an
    // enrolment the user just completed on another device.
    staleTime: 30 * 1000,
  }));

/**
 * Starts enrolment and returns the QR payload.
 *
 * This does NOT turn MFA on — the user must confirm with a real code first, or
 * a failed QR scan would lock them out of their own account.
 */
export const useBeginMFAEnrollment = () =>
  useMutation(() => ({
    mutationFn: async (): Promise<MFAEnrollment> => {
      const response = await authClient.beginMFAEnrollment(
        create(BeginMFAEnrollmentRequestSchema, {}),
      );
      return {
        provisioningUri: response.provisioningUri,
        secret: response.secret,
      };
    },
  }));

/**
 * Confirms enrolment and returns the recovery codes.
 *
 * The codes are returned exactly once — only their hashes are stored — so the
 * caller must show them before navigating away.
 */
export const useConfirmMFAEnrollment = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (code: string): Promise<string[]> => {
      const response = await authClient.confirmMFAEnrollment(
        create(ConfirmMFAEnrollmentRequestSchema, { code: code.trim() }),
      );
      return response.recoveryCodes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mfaKeys.status });
    },
  }));
};

/** Turns MFA off. Requires a current code — a stolen session must not suffice. */
export const useDisableMFA = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ code, recoveryCode }: { code?: string; recoveryCode?: string }) => {
      await authClient.disableMFA(
        create(DisableMFARequestSchema, recoveryCode ? { recoveryCode } : { code }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mfaKeys.status });
    },
  }));
};

/** Replaces every recovery code. The previous set stops working immediately. */
export const useRegenerateRecoveryCodes = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (code: string): Promise<string[]> => {
      const response = await authClient.regenerateRecoveryCodes(
        create(RegenerateRecoveryCodesRequestSchema, { code: code.trim() }),
      );
      return response.recoveryCodes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mfaKeys.status });
    },
  }));
};

/** Formats recovery codes for the "download" button. */
export const recoveryCodesAsText = (codes: string[]): string =>
  [
    "Loci recovery codes",
    "",
    "Each code works once. Keep them somewhere you can reach without your phone.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`),
    "",
  ].join("\n");

// protobuf Timestamps carry seconds as a bigint; Date wants milliseconds.
function timestampToDate(ts: { seconds: bigint; nanos: number }): Date {
  return new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000));
}
