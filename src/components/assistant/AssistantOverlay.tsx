import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  type Component,
} from "solid-js";
import { ArrowUp, Loader2, Mic, Square, Volume2, VolumeX, X } from "lucide-solid";
import { assistantApi, type AssistantApi } from "~/lib/api/assistant";
import { contextFromPath } from "~/lib/assistant/context";
import type { OpenedBy } from "~/lib/assistant/open-state";
import { createAssistantSession } from "~/lib/assistant/session";
import { closingNote } from "~/lib/assistant/turns";
import { dictationUnavailable } from "~/components/ui/DictationButton";
import { useDictation } from "~/lib/hooks/useDictation";
import { useSpeech, type Speech } from "~/lib/hooks/useSpeech";
import { AssistantHandoffCard, AssistantPlaceCard, AssistantTripCard } from "./AssistantCards";

export interface AssistantOverlayProps {
  openedBy: OpenedBy;
  /** Where the person is, read when they ask. */
  path: () => string;
  /** Only ever a position already known: a guessed one answers about the wrong city. */
  coordinates: () => { latitude: number; longitude: number } | null;
  onClose: () => void;
  onHandoff: (query: string, city?: string) => void;
  /** Injected in tests. */
  api?: AssistantApi;
  speech?: Speech;
}

const iconButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muse-text)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Whether the mic can open without a browser prompt appearing out of nowhere. */
async function micAlreadyAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}

/**
 * Ask anything from any screen, by voice or by typing.
 *
 * It keeps its own conversation and its own stream, so a search running in the
 * planner carries on underneath it. Closing it stops the answer and the voice.
 */
const AssistantOverlay: Component<AssistantOverlayProps> = (props) => {
  const api = props.api ?? assistantApi;
  const speech = props.speech ?? useSpeech();
  const session = createAssistantSession(api, speech);
  const [draft, setDraft] = createSignal("");

  const send = (text: string, voice: boolean) => {
    const coords = props.coordinates();
    void session.ask(text, voice, {
      screen: contextFromPath(props.path()),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    });
  };

  // By voice it goes straight off, and the words stay on screen to be checked.
  const dictation = useDictation((text) => send(text, true), { stopOnSilence: true });
  const canTalk = createMemo(() => dictation.supported() && !dictationUnavailable());

  const submit = () => {
    const text = draft().trim();
    if (!text) return;
    speech.unlock();
    setDraft("");
    send(text, false);
  };

  const talk = () => {
    // Tapping is how to interrupt: an open mic would only hear the app itself.
    speech.unlock();
    session.stop();
    dictation.toggle();
  };

  let dialog: HTMLDivElement | undefined;
  let input: HTMLTextAreaElement | undefined;
  let log: HTMLDivElement | undefined;
  const openedFrom = typeof document === "undefined" ? null : document.activeElement;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }
    if (e.key !== "Tab" || !dialog) return;
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, a[href]"),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  onMount(() => {
    // A hold ends with the finger lifting, which is the gesture speech needs.
    const unlock = () => speech.unlock();
    document.addEventListener("pointerup", unlock, { once: true, capture: true });
    onCleanup(() => document.removeEventListener("pointerup", unlock, { capture: true }));

    if (props.openedBy === "keyboard") {
      input?.focus();
      return;
    }
    // No keyboard jumping up over the answer for someone who came here to talk.
    dialog?.focus();
    void micAlreadyAllowed().then((allowed) => {
      if (allowed && canTalk() && dictation.state() === "idle") dictation.toggle();
    });
  });

  onCleanup(() => {
    session.stop();
    (openedFrom as HTMLElement | null)?.focus?.();
  });

  createEffect(() => {
    session.turns();
    if (log) log.scrollTop = log.scrollHeight;
  });

  const micHint = () => {
    if (dictation.error()) return dictation.error();
    switch (dictation.state()) {
      case "recording":
        return "Listening. Stops when you do, or tap the mic.";
      case "transcribing":
        return "Working out what you said…";
      default:
        return null;
    }
  };

  return (
    <div
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Loci"
        tabindex="-1"
        onKeyDown={onKeyDown}
        class="flex max-h-[85dvh] w-full flex-col rounded-t-3xl border border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-xl outline-none md:max-h-[70dvh] md:max-w-xl md:rounded-3xl md:pb-0"
      >
        <header class="flex items-center justify-between px-5 pt-3">
          <h2 class="text-base font-semibold text-[var(--muse-text)]">Ask Loci</h2>
          <div class="flex items-center">
            <button
              type="button"
              class={iconButton}
              aria-pressed={session.speakTyped()}
              aria-label="Read typed answers aloud"
              onClick={() => {
                speech.unlock();
                if (session.speakTyped()) speech.stop();
                session.setSpeakTyped(!session.speakTyped());
              }}
            >
              <Show when={session.speakTyped()} fallback={<VolumeX class="h-5 w-5" />}>
                <Volume2 class="h-5 w-5" />
              </Show>
            </button>
            <button type="button" class={iconButton} aria-label="Close" onClick={props.onClose}>
              <X class="h-5 w-5" />
            </button>
          </div>
        </header>

        <div
          ref={log}
          role="log"
          aria-live="polite"
          class="min-h-32 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-3"
        >
          <Show when={session.turns().length === 0}>
            <p class="text-[15px] text-[var(--muse-text-secondary)]">
              Ask about your trips, your lists, or anywhere you're going.
            </p>
          </Show>
          <For each={session.turns()}>
            {(turn) => (
              <div class="space-y-2" data-testid="assistant-turn">
                <p class="ml-auto w-fit max-w-[85%] rounded-2xl bg-[var(--muse-user-bubble)] px-3 py-2 text-[15px] text-[var(--muse-user-text)]">
                  {turn.you}
                </p>
                <Show when={turn.reply}>
                  <p
                    class="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--muse-text)]"
                    data-testid="assistant-reply"
                  >
                    {turn.reply}
                  </p>
                </Show>
                <Show when={turn.status || (!turn.done && !turn.reply)}>
                  <p class="flex items-center gap-2 text-[13px] text-[var(--muse-text-secondary)]">
                    <Loader2 class="h-3.5 w-3.5 motion-safe:animate-spin" />
                    {turn.status ?? "Thinking…"}
                  </p>
                </Show>
                <For each={turn.cards}>
                  {(card) => (
                    <Switch>
                      <Match when={card.kind === "note" && card}>
                        {(note) => (
                          <p class="text-[13px] font-medium text-[var(--muse-text)]">
                            {note().text}
                          </p>
                        )}
                      </Match>
                      <Match when={card.kind === "trip" && card}>
                        {(trip) => (
                          <AssistantTripCard
                            card={trip()}
                            api={api}
                            onSettled={(n) => session.settleCard(turn.id, card.id, n)}
                          />
                        )}
                      </Match>
                      <Match when={card.kind === "place" && card}>
                        {(place) => (
                          <AssistantPlaceCard
                            card={place()}
                            api={api}
                            onSettled={(n) => session.settleCard(turn.id, card.id, n)}
                          />
                        )}
                      </Match>
                      <Match when={card.kind === "handoff" && card}>
                        {(handoff) => (
                          <AssistantHandoffCard
                            card={handoff()}
                            onStart={() => props.onHandoff(handoff().query, handoff().city)}
                            onDismiss={() => session.settleCard(turn.id, card.id)}
                          />
                        )}
                      </Match>
                    </Switch>
                  )}
                </For>
                <Show when={closingNote(turn)}>
                  <p class="text-[13px] text-[var(--muse-text-secondary)]">
                    {closingNote(turn)}{" "}
                    <Show when={turn.offerChat}>
                      <a href="/chat" class="underline underline-offset-2" onClick={props.onClose}>
                        Open the chat
                      </a>
                    </Show>
                  </p>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="border-t border-border px-3 py-2">
          <Show when={micHint()}>
            <p
              class="px-2 pb-1 text-[13px]"
              classList={{
                "text-destructive": !!dictation.error(),
                "text-[var(--muse-text-secondary)]": !dictation.error(),
              }}
            >
              {micHint()}
            </p>
          </Show>
          <div class="flex items-end gap-1">
            <Show when={canTalk()}>
              <button
                type="button"
                class={`${iconButton} ${dictation.state() === "recording" ? "bg-destructive text-white" : ""}`}
                disabled={dictation.state() === "transcribing"}
                aria-label={dictation.state() === "recording" ? "Stop listening" : "Talk"}
                data-testid="assistant-mic"
                onClick={talk}
              >
                <Show
                  when={dictation.state() === "transcribing"}
                  fallback={
                    <Mic
                      class={`h-5 w-5 ${dictation.state() === "recording" ? "motion-safe:animate-pulse" : ""}`}
                    />
                  }
                >
                  <Loader2 class="h-5 w-5 motion-safe:animate-spin" />
                </Show>
              </button>
            </Show>
            {/* 16px text: iOS zooms the page into anything smaller. */}
            <textarea
              ref={input}
              rows={1}
              value={draft()}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything"
              aria-label="Ask Loci"
              data-testid="assistant-input"
              class="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-[var(--muse-text)] outline-none placeholder:text-[var(--muse-text-secondary)]"
            />
            <Show
              when={session.asking()}
              fallback={
                <button
                  type="button"
                  class={`${iconButton} bg-[var(--muse-user-bubble)] text-[var(--muse-user-text)]`}
                  disabled={!draft().trim()}
                  aria-label="Send"
                  data-testid="assistant-send"
                  onClick={submit}
                >
                  <ArrowUp class="h-5 w-5" />
                </button>
              }
            >
              <button
                type="button"
                class={`${iconButton} bg-[var(--muse-pill)]`}
                aria-label="Stop"
                data-testid="assistant-stop"
                onClick={() => session.stop()}
              >
                <Square class="h-4 w-4" />
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantOverlay;
