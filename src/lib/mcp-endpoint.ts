/**
 * Where agents reach Loci over MCP.
 *
 * Derived from the same base as the Connect transport (`connect-transport.ts`)
 * — `||`, not `??`, so an empty `VITE_CONNECT_BASE_URL` in a `.env` falls back
 * to localhost the way the transport does, rather than producing "/mcp". This
 * used to be pasted in three places; one of them had the production host
 * hardcoded and would have kept pointing at it after a move.
 *
 * The connections page prefers the server's own `instructions.endpoint` once
 * that has loaded; this is the value for copy that renders before (or without)
 * a round trip.
 */
export function mcpEndpointFor(base: string | undefined): string {
  const root = (base || "http://localhost:8000").replace(/\/+$/, "");
  return `${root}/mcp`;
}

export const MCP_ENDPOINT = mcpEndpointFor(import.meta.env.VITE_CONNECT_BASE_URL);
