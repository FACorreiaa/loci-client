import { describe, expect, it } from "vitest";
import { MCP_ENDPOINT, mcpEndpointFor } from "./mcp-endpoint";

describe("mcpEndpointFor", () => {
  it("appends /mcp to the API base", () => {
    expect(mcpEndpointFor("https://api.lociai.fyi")).toBe("https://api.lociai.fyi/mcp");
  });

  it("does not double a trailing slash", () => {
    expect(mcpEndpointFor("https://api.lociai.fyi/")).toBe("https://api.lociai.fyi/mcp");
  });

  it("falls back to localhost for an unset or empty base, like the transport (|| not ??)", () => {
    expect(mcpEndpointFor(undefined)).toBe("http://localhost:8000/mcp");
    expect(mcpEndpointFor("")).toBe("http://localhost:8000/mcp");
  });

  it("exports a constant built from the build-time env", () => {
    expect(MCP_ENDPOINT).toMatch(/\/mcp$/);
  });
});
