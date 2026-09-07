// Outbound MCP servers, over IntegrationService.
//
// These point the other way from API keys: a key lets an agent call Loci, a
// connection lets Loci call somebody else's MCP server — a Hermes instance, a
// calendar — while planning. The catalogue is closed on the server for that
// reason: these are addresses Loci makes requests to, and "connect anything"
// is a request forwarder rather than a feature.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  ConnectRequestSchema,
  DisconnectRequestSchema,
  IntegrationService,
  ListConnectionsRequestSchema,
  TestConnectionRequestSchema,
  type Connection,
} from "@buf/loci_loci-proto.bufbuild_es/loci/integrations/integrations_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const integrationsClient = createClient(IntegrationService, transport);

export const connectionsQueryKey = ["integrations", "connections"] as const;

/**
 * The catalogue, mirrored from `integrations.Catalog` on the server.
 *
 * There is no RPC that returns it, so this list is a copy — Connect refuses a
 * provider outside the server's own catalogue, which is what actually enforces
 * it. Adding one here without adding it there produces a refusal, not an open
 * door.
 */
export const INTEGRATION_PROVIDERS: {
  name: string;
  label: string;
  note: string;
  endpointPlaceholder: string;
}[] = [
  {
    name: "hermes",
    label: "Hermes",
    note: "Your own Hermes instance, reachable over tailnet, LAN, or public HTTPS.",
    endpointPlaceholder: "https://hermes.your-tailnet.ts.net/mcp",
  },
  {
    name: "calendar",
    label: "Calendar",
    note: "An MCP server that can list your events, so a plan avoids the days you are busy.",
    endpointPlaceholder: "https://calendar.example.com/mcp",
  },
];

export interface ConnectionView {
  provider: string;
  endpoint: string;
  /** Whether a token is stored. Never the token. */
  hasToken: boolean;
  createdAt?: number;
  lastSeenAt?: number;
  /** Why the last call failed, empty when it did not. */
  lastError: string;
}

export interface ConnectionsState {
  /** False when the deployment has no encryption key, so no token can be held. */
  enabled: boolean;
  connections: ConnectionView[];
}

function tsToMillis(ts?: Timestamp): number | undefined {
  if (!ts) return undefined;
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000);
}

function toView(c: Connection): ConnectionView {
  return {
    provider: c.provider,
    endpoint: c.endpoint,
    hasToken: c.hasToken,
    createdAt: tsToMillis(c.createdAt),
    lastSeenAt: tsToMillis(c.lastSeenAt),
    lastError: c.lastError,
  };
}

export function useConnections() {
  return useAppQuery(() => ({
    queryKey: connectionsQueryKey,
    queryFn: async (): Promise<ConnectionsState> => {
      const resp = await integrationsClient.listConnections(
        create(ListConnectionsRequestSchema, {}),
      );
      return { enabled: resp.enabled, connections: resp.connections.map(toView) };
    },
    staleTime: 30_000,
  }));
}

export interface ConnectInput {
  provider: string;
  endpoint: string;
  /** Optional: a server on a private network may need no token. */
  accessToken?: string;
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: ConnectInput): Promise<ConnectionView | null> => {
      const resp = await integrationsClient.connect(
        create(ConnectRequestSchema, {
          provider: input.provider,
          endpoint: input.endpoint,
          accessToken: input.accessToken ?? "",
        }),
      );
      return resp.connection ? toView(resp.connection) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
    },
  }));
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (provider: string): Promise<void> => {
      await integrationsClient.disconnect(create(DisconnectRequestSchema, { provider }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
    },
  }));
}

export interface TestConnectionResult {
  ok: boolean;
  /** What the server offers, which is the only proof the endpoint is the right one. */
  toolNames: string[];
  error: string;
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (provider: string): Promise<TestConnectionResult> => {
      const resp = await integrationsClient.testConnection(
        create(TestConnectionRequestSchema, { provider }),
      );
      return { ok: resp.ok, toolNames: resp.toolNames, error: resp.error };
    },
    onSuccess: () => {
      // A failed test is recorded as last_error on the connection.
      queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
    },
  }));
}
