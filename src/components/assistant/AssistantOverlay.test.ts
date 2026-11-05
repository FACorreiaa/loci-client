// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ chatService: {} }));
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import {
  AssistantEventSchema,
  DoneReason,
  PlaceActionKind,
  type AssistantEvent,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import { Code, ConnectError } from "@connectrpc/connect";
import type { AssistantApi, AskParams } from "~/lib/api/assistant";
import AssistantOverlay, { type AssistantOverlayProps } from "./AssistantOverlay";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
});

const event = (value: AssistantEvent["event"]) => create(AssistantEventSchema, { event: value });
const text = (t: string) => event({ case: "textDelta", value: { text: t } as never });
const done = () =>
  event({ case: "done", value: { conversationId: "c1", reason: DoneReason.COMPLETE } as never });
const place = event({
  case: "proposal",
  value: {
    kind: {
      case: "place",
      value: {
        id: "card-1",
        kind: PlaceActionKind.SAVE_FAVORITE,
        poiId: "poi-1",
        poiName: "Belém Tower",
        summary: "Save Belém Tower to your favourites",
      },
    },
    awaitsOwner: false,
  } as never,
});
const handoff = event({
  case: "handoff",
  value: { query: "3 days in Porto", city: "Porto" } as never,
});

async function* play(...events: AssistantEvent[]) {
  yield* events;
}

function mount(
  events: AssistantEvent[] | (() => AsyncIterable<AssistantEvent>),
  over: Partial<AssistantOverlayProps> = {},
) {
  const calls: AskParams[] = [];
  const api: AssistantApi = {
    ask(params) {
      calls.push(params);
      return typeof events === "function" ? events() : play(...events);
    },
    confirm: vi.fn(async () => ({ confirmation: "Saved Belém Tower to your favourites." })),
    dismiss: vi.fn(async () => {}),
  };
  const speech = { say: vi.fn(), stop: vi.fn(), unlock: vi.fn() };
  const onClose = vi.fn();
  const onHandoff = vi.fn();
  const root = document.createElement("div");
  document.body.appendChild(root);
  dispose = render(
    () =>
      createComponent(AssistantOverlay, {
        openedBy: "keyboard",
        path: () => "/trips/11111111-1111-4111-8111-111111111111",
        coordinates: () => null,
        onClose,
        onHandoff,
        api,
        speech,
        ...over,
      }),
    root,
  );
  return { api, calls, speech, onClose, onHandoff };
}

const byTest = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.querySelector<T>(`[data-testid="${id}"]`);

function typeAndSend(question: string) {
  const input = byTest<HTMLTextAreaElement>("assistant-input")!;
  input.value = question;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  byTest("assistant-send")!.click();
}

describe("AssistantOverlay", () => {
  it("is a dialog, and takes the caret when opened from the keyboard", () => {
    mount([]);
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(byTest("assistant-input"));
  });

  it("does not raise the keyboard for someone who held the button", () => {
    mount([], { openedBy: "hold" });
    expect(document.activeElement).toBe(document.querySelector('[role="dialog"]'));
  });

  it("sends what is on screen with the question, and shows the answer", async () => {
    const { calls, speech } = mount([text("It's "), text("in May."), done()]);
    typeAndSend("when is my trip?");
    await flush();

    expect(calls[0].text).toBe("when is my trip?");
    expect(calls[0].voice).toBe(false);
    expect(calls[0].screen.screen).toBe("trip_detail");
    expect(calls[0].latitude).toBeUndefined();
    expect(byTest("assistant-reply")?.textContent).toBe("It's in May.");
    expect(speech.say).not.toHaveBeenCalled();
  });

  it("shows the answer as text, never as markup", async () => {
    mount([text('<img src=x onerror="alert(1)"> [a](https://evil.test)'), done()]);
    typeAndSend("hi");
    await flush();
    const reply = byTest("assistant-reply")!;
    expect(reply.querySelector("img")).toBeNull();
    expect(reply.querySelector("a")).toBeNull();
  });

  it("writes nothing until the card is confirmed, then says what happened", async () => {
    const { api } = mount([place, done()]);
    typeAndSend("save it");
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();

    byTest("assistant-place-confirm")!.click();
    await flush();
    expect(api.confirm).toHaveBeenCalledWith("card-1");
    expect(byTest("assistant-place")).toBeNull();
    expect(document.body.textContent).toContain("Saved Belém Tower to your favourites.");
  });

  it("keeps a card that failed, with the reason, so it can be tried again", async () => {
    const { api } = mount([place, done()]);
    vi.mocked(api.confirm).mockRejectedValueOnce(new ConnectError("no", Code.Internal));
    typeAndSend("save it");
    await flush();

    byTest("assistant-place-confirm")!.click();
    await flush();
    expect(byTest("assistant-place")?.querySelector('[role="alert"]')).not.toBeNull();
    expect(byTest<HTMLButtonElement>("assistant-place-confirm")!.disabled).toBe(false);
  });

  it("takes a card away when it is turned down", async () => {
    const { api } = mount([place, done()]);
    typeAndSend("save it");
    await flush();

    byTest("assistant-place-dismiss")!.click();
    await flush();
    expect(api.dismiss).toHaveBeenCalledWith("card-1");
    expect(byTest("assistant-place")).toBeNull();
  });

  it("starts nothing in the planner until the offer is tapped", async () => {
    const { onHandoff } = mount([handoff, done()]);
    typeAndSend("plan porto");
    await flush();
    expect(onHandoff).not.toHaveBeenCalled();

    byTest("assistant-handoff-start")!.click();
    expect(onHandoff).toHaveBeenCalledWith("3 days in Porto", "Porto");
  });

  it("points at the chat when it is switched off", async () => {
    mount(() =>
      // eslint-disable-next-line require-yield
      (async function* () {
        throw new ConnectError("off", Code.Unimplemented);
      })(),
    );
    typeAndSend("hi");
    await flush();
    expect(document.querySelector('a[href="/chat"]')).not.toBeNull();
  });

  it("closes on Escape and stops talking when it goes", () => {
    const { onClose, speech } = mount([]);
    document
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalled();

    dispose?.();
    dispose = undefined;
    expect(speech.stop).toHaveBeenCalled();
  });

  it("gives focus back to what opened it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    mount([]);
    expect(document.activeElement).not.toBe(opener);
    dispose?.();
    dispose = undefined;
    expect(document.activeElement).toBe(opener);
  });
});
