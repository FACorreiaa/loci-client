import { Component, Show } from "solid-js";
import { Bot, Menu } from "lucide-solid";

export interface ChatHeaderProps {
  activeProfile: string;
  sessionId: string | null;
  onNewChat: () => void;
  /** Opens the chat-history drawer on mobile. */
  onToggleSidebar?: () => void;
}

const ChatHeader: Component<ChatHeaderProps> = (props) => {
  return (
    <div class="border-b border-border bg-card p-3 sm:p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={props.onToggleSidebar}
            class="p-2 -ml-1 text-muted-foreground hover:bg-muted rounded-lg lg:hidden"
            title="Chat history"
            aria-label="Open chat history"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <Bot class="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-base sm:text-lg font-semibold text-foreground truncate">
              AI Travel Assistant
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Get personalized travel recommendations
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <span class="text-xs text-muted-foreground hidden sm:inline">Using:</span>
          <span class="text-xs font-medium text-primary truncate max-w-20 sm:max-w-none">
            {props.activeProfile}
          </span>
          {/* Session indicator and controls */}
          <Show when={props.sessionId}>
            <div class="flex items-center gap-1 text-xs">
              <div class="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span class="text-accent font-medium hidden sm:inline">Connected</span>
              <button
                onClick={props.onNewChat}
                class="ml-1 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded border border-destructive/30"
                title="Clear session and start fresh"
              >
                Clear
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
