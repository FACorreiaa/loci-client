import { describe, expect, it } from "vitest";
import { CLIENT_KINDS, clientKindLabel } from "./api-keys";

describe("CLIENT_KINDS", () => {
  it("offers the six agents in the server's order", () => {
    expect(CLIENT_KINDS.map((k) => k.value)).toEqual([
      "claude_code",
      "claude_desktop",
      "cursor",
      "codex",
      "hermes",
      "other",
    ]);
  });

  it("labels each kind the way its tab reads", () => {
    expect(clientKindLabel("claude_code")).toBe("Claude Code");
    expect(clientKindLabel("claude_desktop")).toBe("Claude Desktop");
    expect(clientKindLabel("cursor")).toBe("Cursor");
    expect(clientKindLabel("codex")).toBe("Codex");
    expect(clientKindLabel("hermes")).toBe("Hermes");
    expect(clientKindLabel("other")).toBe("Other MCP client");
  });

  it("treats anything unknown as the generic client, like the server does", () => {
    expect(clientKindLabel("")).toBe("Other MCP client");
    expect(clientKindLabel("emacs")).toBe("Other MCP client");
  });
});
