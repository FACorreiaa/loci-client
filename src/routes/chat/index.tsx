import { For, Show, lazy, createSignal, createEffect } from "solid-js";
import { Bot, Loader2, MapPin } from "lucide-solid";
import {
  ChatHeader,
  ChatInput,
  ChatQuickPrompts,
  ChatSidebar,
  type QuickPrompt,
} from "~/components/chat";
import ChatMessage from "~/components/chat/ChatMessage";
import { useChat } from "~/lib/hooks/useChat";
const DetailedItemModal = lazy(() => import("~/components/DetailedItemModal"));

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "1",
    text: "Hidden gems in Paris",
    description: "Discover off-the-beaten-path spots",
    domain: "general",
  },
  {
    id: "2",
    text: "Best food markets in Italy",
    description: "Authentic local markets and food",
    domain: "dining",
  },
  {
    id: "3",
    text: "Weekend: Évora or Beja from Porto",
    description: "Compare two cities for a short trip",
    domain: "general",
  },
  {
    id: "4",
    text: "3-day cultural tour of Rome",
    description: "Museums, history, and architecture",
    domain: "itinerary",
  },
  {
    id: "4",
    text: "Family weekend in Amsterdam",
    description: "Kid-friendly activities and places",
    domain: "activities",
  },
  {
    id: "5",
    text: "Photogenic spots in Santorini",
    description: "Calm viewpoints and walking routes",
    domain: "general",
  },
  {
    id: "6",
    text: "Nightlife in Berlin",
    description: "Bars, clubs, and evening culture",
    domain: "activities",
  },
];

export default function ChatPage() {
  const chat = useChat();
  const [selectedItem, setSelectedItem] = createSignal<any | null>(null);
  const [showDetailModal, setShowDetailModal] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  let scrollRef: HTMLDivElement | undefined;
  const [atBottom, setAtBottom] = createSignal(true);

  const onScroll = () => {
    if (!scrollRef) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 80);
  };

  // Auto-scroll to the newest content while streaming, unless the user scrolled up.
  createEffect(() => {
    chat.messages();
    chat.streamingSession();
    chat.streamProgress();
    if (atBottom() && scrollRef) {
      const el = scrollRef;
      queueMicrotask(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    }
  });

  const handleItemClick = (item: any, type: string) => {
    setSelectedItem({ ...item, type });
    setShowDetailModal(true);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chat.sendMessage();
    }
  };

  const useQuickPrompt = (prompt: QuickPrompt) => {
    chat.setCurrentMessage(prompt.text);
    chat.sendMessage();
  };

  return (
    <div class="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      <ChatSidebar
        sessions={chat.sessions()}
        isLoading={chat.chatSessionsQuery.isLoading}
        isError={chat.chatSessionsQuery.isError}
        selectedSession={chat.selectedSession()}
        activeProfile={chat.activeProfileName()}
        profiles={chat.profiles()}
        showProfileSelector={chat.showProfileSelector()}
        open={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          chat.newChat();
          setSidebarOpen(false);
        }}
        onLoadSession={(s) => {
          chat.loadSession(s);
          setSidebarOpen(false);
        }}
        onProfileChange={chat.selectProfileByName}
        onToggleProfileSelector={() => chat.setShowProfileSelector(!chat.showProfileSelector())}
        onRefetch={() => chat.chatSessionsQuery.refetch()}
        isSessionLoading={chat.isLoading()}
      />

      {/* Main Chat Area */}
      <div class="flex-1 flex flex-col order-1 lg:order-2 relative z-10 min-w-0">
        <ChatHeader
          activeProfile={chat.activeProfileName()}
          sessionId={chat.sessionId()}
          onNewChat={chat.newChat}
          onToggleSidebar={() => setSidebarOpen(true)}
        />

        {/* Messages */}
        <div ref={scrollRef} onScroll={onScroll} class="flex-1 overflow-y-auto p-3 sm:p-4 sm:py-6">
          <div class="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            <For each={chat.messages()}>
              {(message) => (
                <ChatMessage
                  message={message}
                  expanded={chat.expandedResults().has(message.id)}
                  onToggle={chat.toggleResultExpansion}
                  onItemClick={handleItemClick}
                  onSave={chat.saveMessage}
                  onShare={chat.shareMessage}
                />
              )}
            </For>

            {/* Loading indicator with streaming progress */}
            <Show when={chat.isLoading()}>
              <div class="flex gap-2 sm:gap-3 justify-start" aria-live="polite">
                <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot class="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                </div>
                <div class="bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-3 py-2 sm:px-4 sm:py-3 max-w-xs sm:max-w-md shadow-sm">
                  <div class="flex items-center gap-1 sm:gap-2 text-muted-foreground mb-2">
                    <Loader2 class="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                    <span class="text-xs sm:text-sm">
                      {chat.streamProgress() || "Processing your request..."}
                    </span>
                  </div>
                  <Show when={chat.streamingSession()}>
                    <div class="text-xs text-muted-foreground space-y-1">
                      <div class="flex items-center gap-1 sm:gap-2">
                        <span class="inline-block w-2 h-2 bg-accent rounded-full flex-shrink-0 animate-pulse motion-reduce:animate-none" />
                        <span class="truncate">Domain: {chat.streamingSession()?.domain}</span>
                      </div>
                      <Show when={chat.streamingSession()?.city}>
                        <div class="flex items-center gap-1 sm:gap-2">
                          <MapPin class="w-3 h-3 flex-shrink-0" />
                          <span class="truncate">City: {chat.streamingSession()?.city}</span>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Quick Prompts */}
            <Show when={chat.messages().length <= 1 && !chat.isLoading()}>
              <ChatQuickPrompts prompts={QUICK_PROMPTS} onSelect={useQuickPrompt} />
            </Show>
          </div>
        </div>

        <ChatInput
          value={chat.currentMessage()}
          isLoading={chat.isLoading()}
          onInput={chat.setCurrentMessage}
          onSend={chat.sendMessage}
          onStop={chat.stopStreaming}
          onKeyPress={handleKeyPress}
        />
      </div>

      <DetailedItemModal
        item={selectedItem()}
        isOpen={showDetailModal()}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
