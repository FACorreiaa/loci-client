import { Component, Show } from "solid-js";
import { Loader2, Mic, Send, Square } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextArea } from "~/ui/textarea";
import { TextFieldRoot } from "~/ui/textfield";
import { useDictation } from "~/lib/hooks/useDictation";

export interface ChatInputProps {
  value: string;
  isLoading: boolean;
  placeholder?: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: KeyboardEvent) => void;
  /** When streaming, the Send button becomes a Stop button. */
  onStop?: () => void;
}

const MAX_TEXTAREA_PX = 160; // ~6 rows

const ChatInput: Component<ChatInputProps> = (props) => {
  // Auto-grow the textarea up to a cap, then scroll.
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  };

  // The transcript lands in the box rather than being sent. Speech recognition
  // mangles place names, and a wrong city produces a confident itinerary for
  // somewhere nobody asked about — so it is put where it can be corrected
  // first. Appended, because dictation is often a second thought added to
  // something already half-typed.
  const dictation = useDictation((text) => {
    const existing = props.value.trim();
    props.onInput(existing === "" ? text : `${existing} ${text}`);
  });

  const dictating = () => dictation.state() !== "idle";

  const micLabel = () => {
    switch (dictation.state()) {
      case "recording":
        return "Stop recording";
      case "transcribing":
        return "Working out what you said";
      default:
        return "Dictate a message";
    }
  };

  return (
    <div class="bg-popover border-t border-border p-3 sm:p-4">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-end gap-2 sm:gap-3">
          <Show when={dictation.supported()}>
            <Button
              type="button"
              variant={dictation.state() === "recording" ? "destructive" : "ghost"}
              size="icon"
              onClick={dictation.toggle}
              disabled={props.isLoading || dictation.state() === "transcribing"}
              aria-label={micLabel()}
              title={micLabel()}
            >
              <Show
                when={dictation.state() === "transcribing"}
                fallback={
                  <Mic
                    class="w-4 h-4"
                    classList={{ "animate-pulse": dictation.state() === "recording" }}
                  />
                }
              >
                <Loader2 class="w-4 h-4 animate-spin" />
              </Show>
            </Button>
          </Show>

          <TextFieldRoot class="flex-1">
            <TextArea
              value={props.value}
              onInput={(e) => {
                props.onInput(e.currentTarget.value);
                autoGrow(e.currentTarget);
              }}
              onKeyPress={props.onKeyPress}
              placeholder={
                props.placeholder ||
                "Ask me about destinations, activities, or let me create an itinerary for you..."
              }
              class="min-h-[56px] max-h-[160px] resize-none"
              disabled={props.isLoading || dictating()}
            />
          </TextFieldRoot>
          <Show
            when={props.isLoading && props.onStop}
            fallback={
              <Button
                onClick={props.onSend}
                disabled={!props.value.trim() || props.isLoading || dictating()}
                class="gap-1 sm:gap-2"
              >
                <Send class="w-4 h-4" />
                <span class="hidden sm:inline">Send</span>
              </Button>
            }
          >
            <Button onClick={props.onStop} variant="destructive" class="gap-1 sm:gap-2">
              <Square class="w-4 h-4 fill-current" />
              <span class="hidden sm:inline">Stop</span>
            </Button>
          </Show>
        </div>
        <p
          class="text-xs mt-2 text-center"
          classList={{
            "text-destructive": !!dictation.error(),
            "text-muted-foreground": !dictation.error(),
          }}
          aria-live="polite"
        >
          {dictation.error() ??
            (dictation.state() === "recording"
              ? "Listening — tap the microphone when you are done."
              : dictation.state() === "transcribing"
                ? "Working out what you said…"
                : "Press Enter to send, Shift+Enter for new line")}
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
