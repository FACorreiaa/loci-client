// Bring-your-own-key hooks over AiCredentialService.
//
// A stored key is write-only by design: the server hands back a hint (the last
// few characters) and never the key, so there is nothing here that reads one
// back. Everything below is shaped around that — "a key ending a203 is stored"
// rather than a populated password field.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  AiCredentialService,
  DeleteCredentialRequestSchema,
  GetCredentialRequestSchema,
  ListProvidersRequestSchema,
  SaveCredentialRequestSchema,
  VerifyCredentialRequestSchema,
  type Credential,
  type Provider,
} from "@buf/loci_loci-proto.bufbuild_es/loci/aicreds/aicreds_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const aiCredsClient = createClient(AiCredentialService, transport);

export const aiCredentialQueryKey = ["ai-credential"] as const;
export const aiProvidersQueryKey = ["ai-providers"] as const;

export interface AiProviderView {
  name: string;
  label: string;
  defaultModel: string;
  /** What the provider's own key looks like, e.g. "sk-…". */
  keyHint: string;
  note: string;
  /** Gateway providers need one; direct providers must not be given one. */
  requiresBaseUrl: boolean;
  supportsVerification: boolean;
}

export interface AiCredentialView {
  provider: string;
  /** The last few characters of the stored key. Never the key. */
  keyHint: string;
  /** Empty means the provider's default model. */
  model: string;
  baseUrl: string;
  /**
   * Why the last call on this credential failed, empty when it did not. Shown
   * because the alternative is an account that quietly falls back to Loci's
   * own provider while still reporting the user's key as in use.
   */
  lastError: string;
  lastErrorAt?: number;
}

/**
 * Whether this deployment can hold a key at all.
 *
 * Storing one requires ENCRYPTION_KEY, and a deployment without it must not
 * pretend otherwise — the server reports the answer rather than the client
 * guessing from a failed save.
 */
export interface AiCredentialState {
  enabled: boolean;
  credential: AiCredentialView | null;
}

function tsToMillis(ts?: Timestamp): number | undefined {
  if (!ts) return undefined;
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000);
}

function toProviderView(p: Provider): AiProviderView {
  return {
    name: p.name,
    label: p.label,
    defaultModel: p.defaultModel,
    keyHint: p.keyHint,
    note: p.note,
    requiresBaseUrl: p.requiresBaseUrl,
    supportsVerification: p.supportsVerification,
  };
}

function toCredentialView(c: Credential): AiCredentialView {
  return {
    provider: c.provider,
    keyHint: c.keyHint,
    model: c.model,
    baseUrl: c.baseUrl,
    lastError: c.lastError,
    lastErrorAt: tsToMillis(c.lastErrorAt),
  };
}

export function useAiProviders() {
  return useAppQuery(() => ({
    queryKey: aiProvidersQueryKey,
    queryFn: async (): Promise<{ enabled: boolean; providers: AiProviderView[] }> => {
      const resp = await aiCredsClient.listProviders(create(ListProvidersRequestSchema, {}));
      return { enabled: resp.enabled, providers: resp.providers.map(toProviderView) };
    },
    // The catalogue changes when the server is redeployed, not while somebody
    // is looking at the page.
    staleTime: 10 * 60_000,
  }));
}

export function useAiCredential() {
  return useAppQuery(() => ({
    queryKey: aiCredentialQueryKey,
    queryFn: async (): Promise<AiCredentialState> => {
      const resp = await aiCredsClient.getCredential(create(GetCredentialRequestSchema, {}));
      return {
        enabled: resp.enabled,
        credential: resp.credential ? toCredentialView(resp.credential) : null,
      };
    },
    staleTime: 30_000,
  }));
}

export interface SaveAiCredentialInput {
  provider: string;
  /**
   * Empty keeps the key already stored, which is how the model or base URL can
   * be changed without retyping a secret the client cannot read back.
   */
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export function useSaveAiCredential() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: SaveAiCredentialInput): Promise<AiCredentialView | null> => {
      const resp = await aiCredsClient.saveCredential(
        create(SaveCredentialRequestSchema, {
          provider: input.provider,
          apiKey: input.apiKey ?? "",
          model: input.model ?? "",
          baseUrl: input.baseUrl ?? "",
        }),
      );
      return resp.credential ? toCredentialView(resp.credential) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiCredentialQueryKey });
    },
  }));
}

export function useDeleteAiCredential() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (): Promise<void> => {
      await aiCredsClient.deleteCredential(create(DeleteCredentialRequestSchema, {}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiCredentialQueryKey });
    },
  }));
}

export interface VerifyAiCredentialResult {
  ok: boolean;
  error: string;
  /** False when the provider offers no cheap check, so "ok" means nothing. */
  checked: boolean;
}

export function useVerifyAiCredential() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (): Promise<VerifyAiCredentialResult> => {
      const resp = await aiCredsClient.verifyCredential(create(VerifyCredentialRequestSchema, {}));
      return { ok: resp.ok, error: resp.error, checked: resp.checked };
    },
    onSuccess: () => {
      // A verification failure is recorded as last_error on the credential.
      queryClient.invalidateQueries({ queryKey: aiCredentialQueryKey });
    },
  }));
}
