// API key hooks using ApiKeyService RPC (programmatic / MCP access).
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  ApiKeyService,
  CreateApiKeyRequestSchema,
  GetSetupInstructionsRequestSchema,
  ListApiKeysRequestSchema,
  RevokeApiKeyRequestSchema,
  type ApiKey,
  type SetupInstructions,
} from "@buf/loci_loci-proto.bufbuild_es/loci/apikey/apikey_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const apiKeyClient = createClient(ApiKeyService, transport);

export const apiKeysQueryKey = ["api-keys"] as const;
export const setupInstructionsQueryKey = (kind: ClientKind) => ["api-keys", "setup", kind] as const;

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
  // Which agent this key's setup was written for. Presentation only — nothing
  // about authentication varies by kind and a key minted for one client works
  // in any of them. It exists so the list can say what a key was made for,
  // which is how somebody decides which one to revoke.
  clientKind: ClientKind;
}

// Mirrors apikey.ClientKinds on the server, in the order it offers them.
export type ClientKind = "claude_code" | "claude_desktop" | "cursor" | "codex" | "hermes" | "other";

export const CLIENT_KINDS: { value: ClientKind; label: string; blurb: string }[] = [
  {
    value: "claude_code",
    label: "Claude Code",
    blurb: "One command, no file to edit.",
  },
  {
    value: "claude_desktop",
    label: "Claude Desktop",
    blurb: "claude_desktop_config.json, via mcp-remote.",
  },
  {
    value: "cursor",
    label: "Cursor",
    blurb: "A server entry in ~/.cursor/mcp.json.",
  },
  {
    value: "codex",
    label: "Codex",
    blurb: "A TOML block in ~/.codex/config.toml.",
  },
  {
    value: "hermes",
    label: "Hermes",
    blurb: "A server entry in your Hermes config.",
  },
  {
    value: "other",
    label: "Other MCP client",
    blurb: "The generic MCP server object, for anything else.",
  },
];

export function clientKindLabel(kind: ClientKind | string): string {
  return CLIENT_KINDS.find((k) => k.value === kind)?.label ?? "Other MCP client";
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
    // Keys minted before client kinds existed carry "other", which the server
    // already substitutes for anything it does not recognise.
    clientKind: (k.clientKind || "other") as ClientKind,
  };
}

export interface UseApiKeysOptions {
  /**
   * How often to refetch, given the keys as last seen. Returning false stops
   * polling. The connections list uses this to watch a freshly made key for
   * its first use without polling forever for everybody.
   */
  refetchInterval?: (keys: ApiKeyView[] | undefined) => number | false;
}

export function useApiKeys(options: UseApiKeysOptions = {}) {
  return useAppQuery(() => ({
    queryKey: apiKeysQueryKey,
    queryFn: async (): Promise<ApiKeyView[]> => {
      const resp = await apiKeyClient.listApiKeys(create(ListApiKeysRequestSchema, {}));
      return resp.apiKeys.map(toView);
    },
    staleTime: 30_000,
    refetchInterval: options.refetchInterval
      ? (query) => options.refetchInterval!(query.state.data)
      : undefined,
  }));
}

export interface CreatedApiKey {
  key: ApiKeyView;
  // Plaintext secret — shown once, never retrievable again.
  plaintext: string;
  // Setup for the client this key was made for, with the real token already
  // substituted. Present only in this response, for the same reason the
  // plaintext is.
  setup: SetupInstructionsView | null;
}

export interface CreateApiKeyInput {
  name: string;
  // Omitted means read-only — the safe default, and what the server applies
  // when no scopes are sent.
  scopes?: ApiKeyScope[];
  // Omitted means "other", the generic MCP configuration.
  clientKind?: ClientKind;
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: CreateApiKeyInput | string): Promise<CreatedApiKey> => {
      const { name, scopes, clientKind } =
        typeof input === "string"
          ? { name: input, scopes: undefined, clientKind: undefined }
          : input;
      const resp = await apiKeyClient.createApiKey(
        create(CreateApiKeyRequestSchema, {
          name,
          scopes: scopes ?? [],
          clientKind: clientKind ?? "",
        }),
      );
      if (!resp.apiKey) throw new Error("server did not return the created key");
      return {
        key: toView(resp.apiKey),
        plaintext: resp.plaintextKey,
        setup: resp.setup ? toSetupView(resp.setup) : null,
      };
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

/**
 * How to point one agent at Loci.
 *
 * The server renders these because the details differ per client and belong
 * next to the code that knows them: Claude Code takes a CLI command, Codex a
 * TOML block, everything else a JSON server object.
 */
export interface SetupInstructionsView {
  clientKind: ClientKind;
  endpoint: string;
  /** What the snippet is, and the syntax to highlight it as. */
  configLabel: string;
  configLang: string;
  config: string;
  /**
   * The same configuration with the token read from an environment variable
   * instead of written into the file, plus the line that sets it.
   *
   * Not an advanced option: `.mcp.json` lives in a project root and is
   * routinely committed, so offering only the literal form is how a token
   * reaches a public repository. Empty for clients whose config is not a file.
   */
  safeLabel: string;
  safeLang: string;
  safe: string;
  safeNote: string;
  exportLine: string;
  /** A first thing to ask the agent, so "it's connected" is observable. */
  prompt: string;
}

function toSetupView(s: SetupInstructions): SetupInstructionsView {
  return {
    clientKind: (s.clientKind || "other") as ClientKind,
    endpoint: s.endpoint,
    configLabel: s.configLabel,
    configLang: s.configLang,
    config: s.config,
    safeLabel: s.safeLabel,
    safeLang: s.safeLang,
    safe: s.safe,
    safeNote: s.safeNote,
    exportLine: s.exportLine,
    prompt: s.prompt,
  };
}

/**
 * The setup for a client kind with a placeholder where the token goes.
 *
 * This exists so "what will I have to do?" can be answered without issuing a
 * credential: minting a key to find out what setup looks like leaves a live
 * credential behind for a question.
 */
export function useSetupInstructions(kind: () => ClientKind) {
  return useAppQuery(() => ({
    queryKey: setupInstructionsQueryKey(kind()),
    queryFn: async (): Promise<SetupInstructionsView | null> => {
      const resp = await apiKeyClient.getSetupInstructions(
        create(GetSetupInstructionsRequestSchema, { clientKind: kind() }),
      );
      return resp.instructions ? toSetupView(resp.instructions) : null;
    },
    // Fixed for a given server build.
    staleTime: 10 * 60_000,
  }));
}
