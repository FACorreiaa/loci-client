// API key hooks using ApiKeyService RPC (programmatic / MCP access).
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  ApiKeyService,
  CreateApiKeyRequestSchema,
  ListApiKeysRequestSchema,
  RevokeApiKeyRequestSchema,
  type ApiKey,
} from "@buf/loci_loci-proto.bufbuild_es/loci/apikey/apikey_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const apiKeyClient = createClient(ApiKeyService, transport);

export const apiKeysQueryKey = ["api-keys"] as const;

// View model with timestamps flattened to millis for easy rendering.
export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt?: number;
  lastUsedAt?: number;
  expiresAt?: number;
  revokedAt?: number;
}

function tsToMillis(ts?: Timestamp): number | undefined {
  if (!ts) return undefined;
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000);
}

function toView(k: ApiKey): ApiKeyView {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: tsToMillis(k.createdAt),
    lastUsedAt: tsToMillis(k.lastUsedAt),
    expiresAt: tsToMillis(k.expiresAt),
    revokedAt: tsToMillis(k.revokedAt),
  };
}

export function useApiKeys() {
  return useAppQuery(() => ({
    queryKey: apiKeysQueryKey,
    queryFn: async (): Promise<ApiKeyView[]> => {
      const resp = await apiKeyClient.listApiKeys(create(ListApiKeysRequestSchema, {}));
      return resp.apiKeys.map(toView);
    },
    staleTime: 30_000,
  }));
}

export interface CreatedApiKey {
  key: ApiKeyView;
  // Plaintext secret — shown once, never retrievable again.
  plaintext: string;
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (name: string): Promise<CreatedApiKey> => {
      const resp = await apiKeyClient.createApiKey(create(CreateApiKeyRequestSchema, { name }));
      if (!resp.apiKey) throw new Error("server did not return the created key");
      return { key: toView(resp.apiKey), plaintext: resp.plaintextKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  }));
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (id: string): Promise<void> => {
      await apiKeyClient.revokeApiKey(create(RevokeApiKeyRequestSchema, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  }));
}
