import { For, Show, lazy, createSignal } from "solid-js";
import { Bot, Loader2, MapPin } from "lucide-solid";
import {
  ChatHeader,
  ChatInput,
  ChatQuickPrompts,
  ChatSidebar,
  type QuickPrompt,
  type TravelProfile,
} from "~/components/chat";
import ChatMessage from "~/components/chat/ChatMessage";
import { useChat } from "~/lib/hooks/useChat";
const DetailedItemModal = lazy(() => import("~/components/DetailedItemModal"));

const PROFILES: TravelProfile[] = [
  { id: "solo", name: "Solo Explorer", icon: "🎒", description: "Independent travel focused" },
  { id: "foodie", name: "Foodie Adventure", icon: "🍽️", description: "Culinary experiences" },
  { id: "family", name: "Family Fun", icon: "👨‍👩‍👧‍👦", description: "Family-friendly activities" },
  { id: "culture", name: "Culture Seeker", icon: "🎨", description: "Museums and arts" },
];

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "1",
    icon: "🌟",
    text: "Hidden gems in Paris",
    description: "Discover off-the-beaten-path spots",
    domain: "general",
  },
  {
    id: "2",
    icon: "🍕",
    text: "Best food markets in Italy",
    description: "Authentic local markets and food",
    domain: "dining",
  },
  {
    id: "3",
    icon: "🏛️",
    text: "3-day cultural tour of Rome",
    description: "Museums, history, and architecture",
    domain: "itinerary",
  },
  {
    id: "4",
    icon: "👨‍👩‍👧‍👦",
    text: "Family weekend in Amsterdam",
    description: "Kid-friendly activities and places",
    domain: "activities",
  },
  {
    id: "5",
    icon: "📸",
    text: "Instagram spots in Santorini",
    description: "Most photogenic locations",
    domain: "general",
  },
  {
    id: "6",
    icon: "🎭",
    text: "Nightlife in Berlin",
    description: "Bars, clubs, and entertainment",
    domain: "activities",
  },
];

export default function ChatPage() {
  const chat = useChat();
  const [selectedItem, setSelectedItem] = createSignal<any | null>(null);
  const [showDetailModal, setShowDetailModal] = createSignal(false);

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

  // The last assistant message is the only one allowed to typewriter.
  const lastAssistantId = () => {
    const list = chat.messages();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].type === "assistant") return list[i].id;
    }
    return null;
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background veil */}
      <div class="absolute inset-0 domain-veil pointer-events-none" />
      <div class="absolute top-0 right-0 w-96 h-96 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <ChatSidebar
        sessions={chat.sessions()}
        isLoading={chat.chatSessionsQuery.isLoading}
        isError={chat.chatSessionsQuery.isError}
        selectedSession={chat.selectedSession()}
        activeProfile={chat.activeProfile()}
        profiles={PROFILES}
        showProfileSelector={chat.showProfileSelector()}
        onNewChat={chat.newChat}
        onLoadSession={chat.loadSession}
        onProfileChange={(p) => {
          chat.setActiveProfile(p);
          chat.setShowProfileSelector(false);
        }}
        onToggleProfileSelector={() => chat.setShowProfileSelector(!chat.showProfileSelector())}
        onRefetch={() => chat.chatSessionsQuery.refetch()}
        isSessionLoading={chat.isLoading()}
      />

      {/* Main Chat Area */}
      <div class="flex-1 flex flex-col order-1 lg:order-2 relative z-10">
        <ChatHeader
          activeProfile={chat.activeProfile()}
          sessionId={chat.sessionId()}
          onNewChat={chat.newChat}
        />

        {/* Messages */}
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 bg-white/30 backdrop-blur-sm">
          <div class="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            <For each={chat.messages()}>
              {(message) => (
                <ChatMessage
                  message={message}
                  expanded={chat.expandedResults().has(message.id)}
                  animate={message.id === lastAssistantId()}
                  onToggle={chat.toggleResultExpansion}
                  onItemClick={handleItemClick}
                />
              )}
            </For>

            {/* Loading indicator with streaming progress */}
            <Show when={chat.isLoading()}>
              <div class="flex gap-2 sm:gap-3 justify-start" aria-live="polite">
                <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-accent flex items-center justify-center flex-shrink-0">
                  <Bot class="w-3 h-3 sm:w-4 sm:h-4 text-white" />
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
                        <span class="inline-block w-2 h-2 bg-primary rounded-full flex-shrink-0" />
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
