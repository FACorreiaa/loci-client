import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ chatService: {} }));
vi.mock("@/lib/connect-transport", () => ({ refreshSession: vi.fn(), transport: {} }));
vi.mock("~/lib/analytics", () => ({ capture: vi.fn() }));

import { DomainType } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { getDomainRoute } from "../streaming-service";
import { domainName } from "./domain-name";
import { responseHasContent } from "./response-content";

describe("gastronomy search routing", () => {
  it("names the proto domain and lands on /gastronomy with the city", () => {
    expect(domainName(DomainType.GASTRONOMY)).toBe("gastronomy");
    expect(getDomainRoute("gastronomy", "s-1", "Madeira")).toBe(
      "/gastronomy?sessionId=s-1&cityName=Madeira&domain=gastronomy",
    );
  });

  it("counts a gastronomy-only answer as content, so completion keeps it", () => {
    expect(responseHasContent({ gastronomy: { dishes: [{ name: "Espetada" }] } } as any)).toBe(
      true,
    );
    expect(responseHasContent({ gastronomy: { dishes: [] } } as any)).toBe(false);
  });
});
