import { createEffect, Show } from "solid-js";
import { MessageCircle, Bot, Loader2, CheckCircle } from "lucide-solid";
import type { StreamingSession } from "~/lib/api/types";
import { useChatRPC } from "~/lib/hooks/useChatRPC";

interface StreamingChatDisplayProps {
  session: () => StreamingSession | null;
  onComplete?: (data: any) => void;
  className?: string;
  initialMessage?: string;
}

export default function StreamingChatDisplay(props: StreamingChatDisplayProps) {
  const { state, startStream } = useChatRPC({
    onComplete: props.onComplete,
  });

  // Start stream when session is valid and not already connected
  createEffect(() => {
    const session = props.session();
    const initMsg = props.initialMessage || "Planning trip...";
    if (
      session &&
      !state.isConnected &&
      !state.isStreaming &&
      !state.error &&
      state.progress === 0
    ) {
      // We need to know what message to send.
      // In the previous flow, the session object might have held this or local storage.
      // Here we'll rely on a prop or default.
      startStream(initMsg, session.city);
    }
  });

  return (
    <div class={`h-full flex flex-col ${props.className || ""}`}>
      {/* Header */}
      <div class="flex items-center gap-3 p-4 border-b border-border bg-card">
        <div class="w-10 h-10 rounded-full bg-[#0c7df2] flex items-center justify-center text-white shadow ring-2 ring-white/50">
          <MessageCircle class="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 class="font-semibold text-foreground">AI Travel Assistant</h3>
          <p class="text-sm text-muted-foreground">
            <Show when={state.isStreaming} fallback="Ready to help">
              {state.currentStep}
            </Show>
          </p>
        </div>
      </div>

      {/* Processing steps indicator */}
      <Show when={state.isStreaming}>
        <div class="p-4 bg-holo/10 border-b border-holo/30">
          <div class="flex items-center gap-2 text-sm">
            <Loader2 class="w-4 h-4 animate-spin text-primary" />
            <span class="text-primary">
              {state.progress}% - {state.currentStep}
            </span>
          </div>
          {/* Simple progress bar */}
          <div class="w-full bg-muted rounded-full h-1.5 mt-2">
            <div class="bg-primary h-1.5 rounded-full" style={{ width: `${state.progress}%` }} />
          </div>
        </div>
      </Show>

      {/* Messages Area - for now just showing status, we can expand to chat history later */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-muted flex items-center justify-center">
        <Show when={!state.isStreaming && state.progress === 100}>
          <div class="text-center">
            <CheckCircle class="w-12 h-12 text-success mx-auto mb-2" />
            <h3 class="text-lg font-medium text-foreground">All Set!</h3>
            <p class="text-muted-foreground">Your itinerary is ready.</p>
          </div>
        </Show>
        <Show when={state.error}>
          <div class="text-destructive text-center">
            <p>{state.error}</p>
          </div>
        </Show>
        <Show when={state.isStreaming}>
          <div class="text-center opacity-75">
            <Bot class="w-12 h-12 text-primary mx-auto mb-2 animate-bounce" />
            <p class="text-muted-foreground">Thinking...</p>
          </div>
        </Show>
      </div>
    </div>
  );
}
