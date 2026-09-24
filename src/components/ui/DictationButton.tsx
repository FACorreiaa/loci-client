// A microphone for a text box: records, transcribes, and hands the words back.
import { createEffect, createSignal, on, Show } from "solid-js";
import { Loader2, Mic } from "lucide-solid";
import { cn } from "~/lib/utils";
import { useDictation, type DictationState } from "~/lib/hooks/useDictation";

/**
 * Adds a transcript to whatever is already in the box.
 *
 * Appended rather than replacing, because dictation is often a second thought
 * added to something half-typed. Both sides are trimmed so the join never
 * leaves a leading or doubled space; an empty transcript leaves the box alone.
 */
export function appendTranscript(existing: string, text: string): string {
  const tail = text.trim();
  if (tail === "") return existing;
  const head = existing.trim();
  return head === "" ? tail : `${head} ${tail}`;
}

// Once the server has said it has no speech configured, every microphone on
// every page would say the same thing again. Only that answer counts: a speech
// service that is merely failing right now is worth another try, so its error
// is shown and the button stays. So the answer is kept for the session
// (until a reload) and the buttons stop being offered.
const [serverUnavailable, setServerUnavailable] = createSignal(false);

/** Whether the server has told this session it has no speech configured. */
export const dictationUnavailable = serverUnavailable;

/** Forgets that the server was unavailable. For tests. */
export function resetDictationAvailability(): void {
  setServerUnavailable(false);
}

export interface DictationStatus {
  state: DictationState;
  /** What went wrong, for the person to read; null when nothing did. */
  error: string | null;
}

export interface DictationButtonProps {
  /**
   * Receives what was said. The host puts it in its box — normally through
   * {@link appendTranscript} — and never sends it on its own: speech
   * recognition mangles place names, and a wrong city produces a confident
   * itinerary for somewhere nobody asked about.
   */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** "hero" is for the dark hero surface; "default" sits inside a light input. */
  variant?: "default" | "hero";
  class?: string;
  /**
   * Told whenever recording state or the error changes, so the host can lock
   * its box and submit while a recording is in flight, and show a
   * {@link DictationHint} wherever it fits its layout.
   */
  onStatusChange?: (status: DictationStatus) => void;
  /** Accessible name while idle. */
  label?: string;
}

const variantClasses = {
  default: {
    base: "h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    recording: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  hero: {
    base: "h-12 w-12 rounded-xl border border-primary-foreground/25 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground",
    recording:
      "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
  },
} as const;

export default function DictationButton(props: DictationButtonProps) {
  const dictation = useDictation((text) => props.onTranscript(text));

  createEffect(
    on(
      () => dictation.errorKind(),
      (kind) => {
        if (kind === "not-configured") setServerUnavailable(true);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => ({ state: dictation.state(), error: dictation.error() }),
      (status) => props.onStatusChange?.(status),
      { defer: true },
    ),
  );

  const recording = () => dictation.state() === "recording";
  const transcribing = () => dictation.state() === "transcribing";
  const styles = () => variantClasses[props.variant ?? "default"];

  const label = () => {
    if (recording()) return "Stop recording";
    if (transcribing()) return "Working out what you said";
    return props.label ?? "Dictate";
  };

  return (
    <Show when={dictation.supported() && !serverUnavailable()}>
      <button
        type="button"
        onClick={dictation.toggle}
        // A recording in progress can always be stopped, even if the host has
        // since become busy; otherwise the microphone would stay open.
        disabled={transcribing() || (!!props.disabled && !recording())}
        aria-label={label()}
        aria-pressed={recording()}
        title={label()}
        data-testid="dictation-button"
        class={cn(
          "inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
          styles().base,
          recording() && styles().recording,
          props.class,
        )}
      >
        <Show
          when={transcribing()}
          fallback={
            <Mic class="h-4 w-4" classList={{ "animate-pulse": recording() }} aria-hidden="true" />
          }
        >
          <Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
        </Show>
      </button>
    </Show>
  );
}

/** The line to show under a box for a dictation status; empty when there is nothing to say. */
export function dictationHintText(status: DictationStatus): string {
  if (status.error) return status.error;
  if (status.state === "recording") return "Listening — tap the microphone when you are done.";
  if (status.state === "transcribing") return "Working out what you said…";
  return "";
}

export interface DictationHintProps {
  status: DictationStatus;
  class?: string;
  /** Added on top of `class` when the line is an error. */
  errorClass?: string;
}

/**
 * The spoken-aloud status line for a {@link DictationButton}.
 *
 * Always in the document, because a live region added at the same moment as
 * its text is often not announced. When there is nothing to say it is visually
 * hidden rather than removed, so it takes no space under the box.
 */
export function DictationHint(props: DictationHintProps) {
  const text = () => dictationHintText(props.status);
  return (
    <p
      aria-live="polite"
      class={cn(text() === "" ? "sr-only" : props.class, !!props.status.error && props.errorClass)}
    >
      {text()}
    </p>
  );
}
