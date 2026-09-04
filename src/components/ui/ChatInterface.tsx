import { For, Show, Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Bot, Loader2, MessageCircle, Send, User, X } from "lucide-solid";
import type { ChatMessage } from "~/lib/hooks/useChatSession";

export interface ChatInterfaceProps {
  showChat: boolean;
  chatMessage: string;
  chatHistory: ChatMessage[];
  isLoading: boolean;
  setShowChat: (show: boolean) => void;
  setChatMessage: (message: string) => void;
  sendChatMessage: () => void;
  handleKeyPress: (e: KeyboardEvent) => void;
  title?: string;
  placeholder?: string;
  emptyStateIcon?: Component;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  loadingMessage?: string;
}

export default function ChatInterface(props: ChatInterfaceProps) {
  const title = () => props.title || "Ask Loci";
  const placeholder = () => props.placeholder || "Ask about your trip…";
  const emptyStateTitle = () => props.emptyStateTitle || "Start a field note";
  const emptyStateSubtitle = () =>
    props.emptyStateSubtitle || "Ask for places, routes, or a day plan.";
  const loadingMessage = () => props.loadingMessage || "Thinking…";

  const emptyIcon = () => props.emptyStateIcon || MessageCircle;

  return (
    <>
      <Show when={!props.showChat}>
        <button
          onClick={() => props.setShowChat(true)}
          class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg motion-settle motion-press hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open Ask Loci"
        >
          <MessageCircle class="h-6 w-6" />
        </button>
      </Show>

      <Show when={props.showChat}>
        <div
          class="fixed bottom-6 right-6 z-50 flex h-[min(560px,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col island-panel rounded-xl focus:outline-none"
          role="dialog"
          aria-modal="true"
          aria-label={title()}
          tabIndex={-1}
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot class="h-4 w-4" />
              </span>
              <div>
                <span class="block font-serif text-sm font-semibold leading-tight">{title()}</span>
                <span class="font-coord text-[10px] uppercase tracking-widest text-muted-foreground">
                  Field guide
                </span>
              </div>
            </div>
            <button
              onClick={() => props.setShowChat(false)}
              class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground motion-settle min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close chat"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
            <Show when={props.chatHistory.length === 0}>
              <div class="py-8 text-center text-muted-foreground">
                <Dynamic
                  component={emptyIcon()}
                  class="mx-auto mb-4 h-10 w-10 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <p class="font-serif text-sm font-medium text-foreground">{emptyStateTitle()}</p>
                <p class="mt-2 text-xs">{emptyStateSubtitle()}</p>
              </div>
            </Show>

            <For each={props.chatHistory}>
              {(message) => (
                <div
                  class={`flex gap-2 ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Show when={message.type !== "user"}>
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot class="h-3.5 w-3.5" />
                    </div>
                  </Show>
                  <div
                    class={`max-w-[85%] rounded-2xl px-3 py-2 text-sm motion-enter ${
                      message.type === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.type === "error"
                          ? "border border-destructive/30 bg-destructive/10 text-destructive"
                          : "loci-card"
                    }`}
                  >
                    <p class="whitespace-pre-wrap">{message.content}</p>
                    <p
                      class={`mt-1 font-coord text-[10px] uppercase tracking-wide opacity-70 ${
                        message.type === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Show when={message.type === "user"}>
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User class="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={props.isLoading}>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="h-4 w-4 animate-spin" />
                {loadingMessage()}
              </div>
            </Show>
          </div>

          <div class="border-t border-border p-3">
            <div class="flex items-end gap-2">
              <textarea
                value={props.chatMessage}
                onInput={(e) => props.setChatMessage(e.currentTarget.value)}
                onKeyPress={props.handleKeyPress}
                placeholder={placeholder()}
                disabled={props.isLoading}
                rows={2}
                class="min-h-[52px] max-h-32 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                onClick={props.sendChatMessage}
                disabled={!props.chatMessage.trim() || props.isLoading}
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground motion-settle motion-press disabled:opacity-50"
                aria-label="Send message"
              >
                <Send class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
