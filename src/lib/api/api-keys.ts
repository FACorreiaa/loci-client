// API key hooks using ApiKeyService RPC (programmatic / MCP access).
import { useMutation, useQueryClient } from "@tanstack/solid-query";
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
  // What this key may do. A key authenticates as its owning user, so scopes are
  // the only thing narrowing it from full account access.
  scopes: ApiKeyScope[];
}

// Capabilities a key can hold. No scope implies another: a key that must read
// and write is minted with both.
export type ApiKeyScope = "read" | "write" | "write:generate";

export const API_KEY_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  {
    value: "read",
    label: "Read",
    description: "Search places and read your saved lists, favourites and itineraries.",
  },
  {
    value: "write",
    label: "Write",
    description: "Add favourites, edit lists and change your saved itineraries.",
  },
  {
    value: "write:generate",
    label: "Generate",
    description:
      "Run AI generation, which spends your daily quota. Separate from Write because it costs money per call.",
  },
];

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
    scopes: (k.scopes ?? []) as ApiKeyScope[],
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

export interface CreateApiKeyInput {
  name: string;
  // Omitted means read-only — the safe default, and what the server applies
  // when no scopes are sent.
  scopes?: ApiKeyScope[];
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: CreateApiKeyInput | string): Promise<CreatedApiKey> => {
      const { name, scopes } =
        typeof input === "string" ? { name: input, scopes: undefined } : input;
      const resp = await apiKeyClient.createApiKey(
        create(CreateApiKeyRequestSchema, { name, scopes: scopes ?? [] }),
      );
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
