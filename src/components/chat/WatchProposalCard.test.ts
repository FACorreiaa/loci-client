// @vitest-environment happy-dom

import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ConversationMessageSchema,
  MessageOrigin,
  MessageRole,
  WatchProposalSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { WatchApi } from "~/lib/api/watches";
import WatchProposalCard from "./WatchProposalCard";

const proposal = create(WatchProposalSchema, {
  title: "Rain in Lisbon",
  scheduleHuman: "Every day at 08:00",
  intervalMinutes: 1440,
  spec: "Check tomorrow's forecast for Lisbon and tell me if rain is expected.",
});

const confirmation = create(ConversationMessageSchema, {
  id: "c1",
  role: MessageRole.ASSISTANT,
  content: "Got it — I'll watch rain in Lisbon and ping you when it's forecast.",
  origin: MessageOrigin.PROACTIVE,
  sourceLabel: "Standing task",
});

const fakeApi = (createImpl: WatchApi["create"]): WatchApi => ({
  propose: vi.fn(),
  create: vi.fn(createImpl),
  list: vi.fn(),
  remove: vi.fn(),
});

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
});

const mount = (api: WatchApi, session: string | null = "sess-1") => {
  const sessionId = session ?? undefined;
  const onCreated = vi.fn();
  const onDismiss = vi.fn();
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => createComponent(WatchProposalCard, { proposal, sessionId, api, onCreated, onDismiss }),
    host,
  );
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!;
  const error = () => host.querySelector('[data-testid="watch-error"]')?.textContent ?? null;
  return { host, onCreated, onDismiss, button, error };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("WatchProposalCard", () => {
  it("shows title, schedule in words, the spec line and both buttons", () => {
    const { host, button } = mount(fakeApi(async () => ({})));
    expect(host.querySelector('[data-testid="watch-title"]')!.textContent).toBe("Rain in Lisbon");
    expect(host.querySelector('[data-testid="watch-schedule"]')!.textContent).toBe(
      "Every day at 08:00",
    );
    expect(host.querySelector('[data-testid="watch-spec"]')!.textContent).toContain(
      "tomorrow's forecast",
    );
    expect(host.querySelector('[data-testid="proactive-caption"]')!.textContent).toBe(
      "Standing task",
    );
    expect(button("Confirm")).toBeTruthy();
    expect(button("Not now")).toBeTruthy();
  });

  it("is styled as an agent bubble (agent fill, card radius)", () => {
    const { host } = mount(fakeApi(async () => ({})));
    const card = host.querySelector("section")!;
    expect(card.className).toContain("bg-[var(--muse-agent-bubble)]");
    expect(card.className).toContain("rounded-2xl");
  });

  it("Confirm calls CreateWatch with the session and the proposal unchanged", async () => {
    const api = fakeApi(async () => ({ confirmation }));
    const { button, onCreated, onDismiss } = mount(api);
    button("Confirm").click();
    await flush();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith("sess-1", proposal);
    expect(onCreated).toHaveBeenCalledWith(confirmation);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("disables both buttons while CreateWatch is in flight", async () => {
    let resolve!: (v: { confirmation: typeof confirmation }) => void;
    const api = fakeApi(() => new Promise((r) => (resolve = r)));
    const { host, onCreated } = mount(api);
    const [confirmBtn] = host.querySelectorAll("button");
    confirmBtn.click();
    await flush();
    expect(confirmBtn.textContent).toBe("Setting up…");
    expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
    confirmBtn.click();
    expect(api.create).toHaveBeenCalledTimes(1);
    resolve({ confirmation });
    await flush();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("Not now makes no call", () => {
    const api = fakeApi(async () => ({}));
    const { button, onDismiss, onCreated } = mount(api);
    button("Not now").click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.propose).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("asks to wait, without calling, when the conversation has no session yet", async () => {
    const api = fakeApi(async () => ({}));
    const { button, error } = mount(api, null);
    button("Confirm").click();
    await flush();
    expect(api.create).not.toHaveBeenCalled();
    expect(error()).toMatch(/still starting this conversation/);
  });

  it.each([
    [Code.InvalidArgument, /couldn't set that up as written/],
    [Code.NotFound, /conversation isn't saved yet/],
    [Code.ResourceExhausted, /already have 10 standing tasks/],
    [Code.Unauthenticated, /Sign in again/],
    [Code.Internal, /aren't available right now/],
    [Code.Unavailable, /aren't available right now/],
  ])("shows friendly copy for %s and lets the user retry", async (code, copy) => {
    let fail = true;
    const api = fakeApi(async () => {
      if (fail) throw new ConnectError("raw server text", code);
      return { confirmation };
    });
    const { button, error, onCreated, host } = mount(api);
    button("Confirm").click();
    await flush();
    expect(error()).toMatch(copy);
    expect(error()).not.toContain("raw server text");
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
    // Buttons come back; a retry goes through and clears the error.
    fail = false;
    button("Confirm").click();
    await flush();
    expect(onCreated).toHaveBeenCalledWith(confirmation);
  });
});
