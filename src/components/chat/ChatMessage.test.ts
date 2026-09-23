// @vitest-environment happy-dom

import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage as ChatMessageType } from "~/lib/hooks/useChat";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import { formatMessageContent } from "./format-message-content";

// lucide-solid's barrel is ~1,600 icon modules; transforming them costs ~25s per
// run. Every icon becomes a bare <svg>, which is all these tests look for.
vi.mock("lucide-solid", () => {
  const Icon = () => document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => (key === "then" || key === "__esModule" ? undefined : Icon),
    has: () => true,
  });
});

// Persisted assistant turns come back from the server as the raw stream
// payloads, tagged and concatenated in whatever order the sections finished:
//
//   [city_data]\n{...}\n\n[general_pois]\n{...}\n\n[itinerary]\n{...}
//
// The server is being fixed to store prose, but until every old session is
// gone the client must never put JSON in a chat bubble.

const CITY = JSON.stringify({
  city: "Funchal",
  country: "Portugal",
  description: "Madeira's capital, terraced above a wide bay.",
});

const POIS = JSON.stringify({
  points_of_interest: [
    { name: "Mercado dos Lavradores", category: "market" },
    { name: "Monte Palace", category: "garden" },
  ],
});

const ITINERARY = JSON.stringify({
  itinerary_name: "Two days in Funchal",
  points_of_interest: [
    { name: "Sé Cathedral", category: "landmark" },
    { name: "Monte Palace", category: "garden" },
    { name: "Cabo Girão", category: "viewpoint" },
  ],
});

const looksRaw = (s: string) => /^[[{]/.test(s.trim());

describe("formatMessageContent", () => {
  describe("multi-part tagged blobs", () => {
    const orderA = `[city_data]\n${CITY}\n\n[general_pois]\n${POIS}\n\n[itinerary]\n${ITINERARY}`;
    const orderB = `[itinerary]\n${ITINERARY}\n\n[city_data]\n${CITY}\n\n[general_pois]\n${POIS}`;

    it("produces the same sentence regardless of section order", () => {
      expect(formatMessageContent(orderA)).toBe(formatMessageContent(orderB));
    });

    it("prefers the itinerary section", () => {
      const out = formatMessageContent(orderA);
      expect(out).toContain("3 places");
      expect(out).toContain("Sé Cathedral");
    });

    it("never starts with a bracket or brace", () => {
      expect(looksRaw(formatMessageContent(orderA))).toBe(false);
      expect(looksRaw(formatMessageContent(orderB))).toBe(false);
    });

    it("falls through to the next section when the preferred one is broken", () => {
      const broken = `[itinerary]\n{not json\n\n[city_data]\n${CITY}`;
      expect(formatMessageContent(broken)).toMatch(/^Let me tell you about Funchal, Portugal/);
    });

    it("uses the domain and city for the fallback when nothing parses", () => {
      const out = formatMessageContent(
        `[hotels]\n{"city":"Funchal","hotels":[oops\n\n[city_data]\n{broken`,
      );
      expect(looksRaw(out)).toBe(false);
      expect(out).toContain("hotel");
      expect(out).toContain("for Funchal");
    });
  });

  describe("single tagged blob", () => {
    it("turns city data into a sentence", () => {
      const out = formatMessageContent(`[city_data]${CITY}`);
      expect(out.startsWith("Let me tell you about Funchal, Portugal")).toBe(true);
    });

    it("turns city data on its own line into the same sentence", () => {
      expect(formatMessageContent(`[city_data]\n${CITY}`)).toBe(
        formatMessageContent(`[city_data]${CITY}`),
      );
    });

    it("handles a json fence inside the section", () => {
      const out = formatMessageContent("[city_data]\n```json\n" + CITY + "\n```");
      expect(out.startsWith("Let me tell you about Funchal, Portugal")).toBe(true);
    });

    it("falls back to a completion sentence when the body is not JSON", () => {
      const out = formatMessageContent('[restaurants]\n{"city":"Porto", "restaurants": [');
      expect(looksRaw(out)).toBe(false);
      expect(out).toContain("restaurants");
      expect(out).toContain("for Porto");
    });

    it("reads well when no city can be found", () => {
      const out = formatMessageContent("[activities]\n{broken");
      expect(out).not.toMatch(/\s\./);
      expect(out).not.toMatch(/\s{2,}/);
    });

    it("shows prose under a tag as prose, without the tag", () => {
      const out = formatMessageContent("[itinerary]\nHere is your plan for Funchal.");
      expect(out).toBe("Here is your plan for Funchal.");
    });
  });

  describe("plain text", () => {
    it("passes markdown through unchanged", () => {
      const md =
        "**Funchal** is lovely.\n\n- Monte Palace\n- Cabo Girão\n\n[Book here](https://example.com)";
      expect(formatMessageContent(md)).toBe(md);
    });

    it("passes text that starts with a markdown link through unchanged", () => {
      const md = "[Monte Palace](https://example.com) is worth the cable car.";
      expect(formatMessageContent(md)).toBe(md);
    });

    it("passes a short answer through unchanged", () => {
      expect(formatMessageContent("Sure, what dates?")).toBe("Sure, what dates?");
    });
  });

  describe("untagged JSON", () => {
    it("formats a bare city payload", () => {
      expect(formatMessageContent(CITY)).toMatch(/^Let me tell you about Funchal, Portugal/);
    });

    it("formats a bare array of places", () => {
      const out = formatMessageContent(
        JSON.stringify([
          { name: "Taberna Ruel", category: "restaurant", cuisine_type: "Madeiran" },
          { name: "Kampo", category: "restaurant", cuisine_type: "Modern" },
        ]),
      );
      expect(out).toContain("2 great restaurants");
    });

    it("replaces unparseable JSON with a completion sentence", () => {
      const out = formatMessageContent("{garbage");
      expect(looksRaw(out)).toBe(false);
      expect(out.length).toBeGreaterThan(20);
    });

    it("never echoes a parsed-but-unrecognised object", () => {
      const out = formatMessageContent('{"foo": 1}');
      expect(looksRaw(out)).toBe(false);
    });
  });
});

// Muse chat contract (apps/_reviews/muse-chat-contract.md): the header carries
// who is speaking, so a bubble has no inline avatar and no per-message name.
describe("ChatMessage (Muse restyle)", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = "";
  });

  const mount = (message: Partial<ChatMessageType>) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () =>
        createComponent(ChatMessage, {
          message: {
            id: "m1",
            type: "assistant",
            content: "Funchal is lovely in **October**.",
            timestamp: new Date("2026-09-23T10:00:00Z"),
            ...message,
          } as ChatMessageType,
          expanded: false,
          onToggle: () => {},
          onItemClick: () => {},
        }),
      host,
    );
    return host;
  };

  const bubble = (host: HTMLElement) =>
    host.querySelector<HTMLElement>('[data-testid="chat-bubble"]')!;

  it("renders an agent bubble with no avatar and no name label", () => {
    const host = mount({ type: "assistant" });
    expect(host.querySelector("svg")).toBeNull();
    expect(host.querySelector("img")).toBeNull();
    const texts = [...host.querySelectorAll("p, span")].map((el) => el.textContent?.trim());
    expect(texts).not.toContain("Loci");
    expect(bubble(host).textContent).toContain("Funchal is lovely");
  });

  it("renders a user bubble with no avatar", () => {
    const host = mount({ type: "user", content: "Two days in Funchal?" });
    expect(host.querySelector("svg")).toBeNull();
    expect(host.querySelector("img")).toBeNull();
    expect(bubble(host).textContent).toBe("Two days in Funchal?");
  });

  it("paints the agent bubble in Muse tokens, radius 24, max 94%", () => {
    const host = mount({ type: "assistant" });
    const cls = bubble(host).className;
    expect(cls).toContain("bg-[var(--muse-agent-bubble)]");
    expect(cls).toContain("text-[var(--muse-text)]");
    expect(cls).toContain("rounded-[24px]");
    expect(bubble(host).parentElement!.className).toContain("max-w-[94%]");
  });

  it("paints the user bubble coral with ink text, radius 24, max 85%", () => {
    const host = mount({ type: "user", content: "hi" });
    const cls = bubble(host).className;
    expect(cls).toContain("bg-[var(--muse-user-bubble)]");
    expect(cls).toContain("text-[var(--muse-user-text)]");
    expect(cls).toContain("rounded-[24px]");
    expect(bubble(host).parentElement!.className).toContain("max-w-[85%]");
  });
});

describe("ChatHeader (Muse restyle)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the mascot avatar, the name and the Ready status", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => createComponent(ChatHeader, { onNewChat: () => {} }), host);
    const avatar = host.querySelector<HTMLImageElement>('[data-testid="muse-avatar"]');
    expect(avatar?.getAttribute("src")).toBe("/images/brand/mascot.webp");
    expect(host.querySelector("h1")?.textContent).toBe("Loci");
    expect(host.querySelector('[role="status"] p')?.textContent).toBe("Ready");
    expect(host.textContent).toContain("New chat");
    dispose();
  });
});
