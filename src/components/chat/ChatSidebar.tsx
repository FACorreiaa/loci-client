import { For, Show, Component } from "solid-js";
import { MapPin, Sparkles, MessageCircle, Loader2, Plus, X } from "lucide-solid";

export interface ChatSessionSummary {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messageCount: number;
  hasItinerary: boolean;
  cityName?: string;
  isLocal?: boolean;
  performanceMetrics?: {
    avg_response_time_ms: number;
  };
  contentMetrics?: {
    total_pois: number;
    total_hotels: number;
    total_restaurants: number;
    complexity_score: number;
  };
  engagementMetrics?: {
    engagement_level: "low" | "medium" | "high";
  };
}

export interface TravelProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  isLoading: boolean;
  isError: boolean;
  selectedSession: ChatSessionSummary | null;
  activeProfile: string;
  profiles: TravelProfile[];
  showProfileSelector: boolean;
  onNewChat: () => void;
  onLoadSession: (session: ChatSessionSummary) => void;
  onProfileChange: (profile: string) => void;
  onToggleProfileSelector: () => void;
  onRefetch: () => void;
  isSessionLoading: boolean;
  /** Drawer open state on mobile (always visible as a rail on lg+). */
  open?: boolean;
  onClose?: () => void;
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ChatSidebar: Component<ChatSidebarProps> = (props) => {
  return (
    <>
      {/* Mobile backdrop */}
      <Show when={props.open}>
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={props.onClose}
        />
      </Show>

      <div
        class={`flex flex-col border-r border-border bg-card z-40 fixed inset-y-0 left-0 w-72 sm:w-80 transform transition-transform duration-300 ease-in-out lg:static lg:inset-auto lg:w-80 lg:translate-x-0 lg:order-1 lg:z-10 ${
          props.open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div class="p-3 sm:p-4 border-b border-border">
          <div class="flex items-center justify-between mb-3 sm:mb-4">
            <h2 class="text-base sm:text-lg font-semibold text-foreground">AI Assistant</h2>
            <div class="flex items-center gap-1">
              <button
                onClick={props.onNewChat}
                class="cb-button cb-button-primary p-2 text-sm"
                title="New chat"
              >
                <Plus class="w-4 h-4" />
              </button>
              <button
                onClick={props.onClose}
                class="p-2 text-muted-foreground hover:bg-muted rounded-lg lg:hidden"
                title="Close"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Profile Selector */}
          <div class="relative">
            <button
              onClick={props.onToggleProfileSelector}
              class="w-full flex items-center gap-2 p-2 sm:p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-all border border-border"
            >
              <div class="w-6 h-6 sm:w-8 sm:h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs sm:text-sm">
                🎒
              </div>
              <div class="flex-1 text-left min-w-0">
                <p class="text-xs sm:text-sm font-medium text-foreground truncate">
                  {props.activeProfile}
                </p>
                <p class="text-xs text-muted-foreground hidden sm:block">Active profile</p>
              </div>
            </button>

            <Show when={props.showProfileSelector}>
              <div class="absolute top-full left-0 right-0 mt-2 z-10 loci-card max-h-60 overflow-y-auto">
                <For each={props.profiles}>
                  {(profile) => (
                    <button
                      onClick={() => {
                        props.onProfileChange(profile.name);
                      }}
                      class={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl ${
                        props.activeProfile === profile.name
                          ? "bg-primary/10 text-primary"
                          : "text-foreground"
                      }`}
                    >
                      <span class="text-base sm:text-lg">{profile.icon}</span>
                      <div class="flex-1 text-left min-w-0">
                        <p class="text-xs sm:text-sm font-medium truncate">{profile.name}</p>
                        <p class="text-xs text-muted-foreground hidden sm:block">
                          {profile.description}
                        </p>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Chat Sessions List */}
        <div class="flex-1 overflow-y-auto">
          <div class="p-3 sm:p-4">
            <h3 class="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
              Recent Conversations
            </h3>

            <Show when={props.isLoading}>
              <div class="flex items-center justify-center py-8">
                <Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            </Show>

            <Show when={props.isError}>
              <div class="text-center py-4 px-3">
                <div class="w-12 h-12 mx-auto mb-3 bg-destructive/10 rounded-full flex items-center justify-center">
                  <MessageCircle class="w-6 h-6 text-destructive" />
                </div>
                <p class="text-xs text-destructive font-medium mb-1">Chat History Unavailable</p>
                <p class="text-xs text-muted-foreground mb-3 leading-relaxed">
                  There's a temporary issue loading your chat history. You can still start new
                  conversations.
                </p>
                <button onClick={props.onRefetch} class="text-xs text-primary hover:underline">
                  Try again
                </button>
              </div>
            </Show>

            <Show when={!props.isLoading && !props.isError}>
              <div class="space-y-1 sm:space-y-2">
                <Show when={props.sessions.length === 0}>
                  <div class="text-center py-8 px-4">
                    <div class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                      <MessageCircle class="w-8 h-8 text-primary" />
                    </div>
                    <h3 class="text-sm font-medium text-foreground mb-2">No chat history yet</h3>
                    <p class="text-xs text-muted-foreground mb-4 leading-relaxed">
                      Start a conversation to explore destinations, get recommendations, and create
                      personalized itineraries.
                    </p>
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <div class="w-2 h-2 bg-accent rounded-full" />
                        <span>Ask about any destination</span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <div class="w-2 h-2 bg-primary rounded-full" />
                        <span>Get personalized recommendations</span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <div class="w-2 h-2 bg-accent rounded-full" />
                        <span>Create custom itineraries</span>
                      </div>
                    </div>
                  </div>
                </Show>

                <For each={props.sessions}>
                  {(session) => (
                    <button
                      onClick={() => props.onLoadSession(session)}
                      disabled={props.isSessionLoading}
                      class={`w-full text-left p-2 sm:p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        props.selectedSession?.id === session.id
                          ? "bg-primary/10 border border-primary/30"
                          : "border border-transparent"
                      }`}
                    >
                      <div class="flex items-start justify-between mb-1">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-1">
                            <h4 class="text-xs sm:text-sm font-medium text-foreground truncate">
                              {session.title}
                            </h4>
                            {session.isLocal && (
                              <span
                                class="text-xs bg-accent/15 text-accent px-1 py-0.5 rounded"
                                title="Stored locally (backend unavailable)"
                              >
                                📱
                              </span>
                            )}
                          </div>
                          <Show when={session.cityName}>
                            <div class="flex items-center gap-1 mt-0.5">
                              <MapPin class="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span class="text-xs text-muted-foreground truncate">
                                {session.cityName}
                              </span>
                            </div>
                          </Show>
                          {/* Content metrics summary */}
                          <Show when={session.contentMetrics}>
                            <div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Show when={session.contentMetrics!.total_pois > 0}>
                                <span class="bg-primary/10 text-primary px-1 py-0.5 rounded text-xs">
                                  {session.contentMetrics!.total_pois} POIs
                                </span>
                              </Show>
                              <Show when={session.contentMetrics!.total_hotels > 0}>
                                <span class="bg-accent/10 text-accent px-1 py-0.5 rounded text-xs">
                                  {session.contentMetrics!.total_hotels} Hotels
                                </span>
                              </Show>
                              <Show when={session.contentMetrics!.total_restaurants > 0}>
                                <span class="bg-primary/10 text-primary px-1 py-0.5 rounded text-xs">
                                  {session.contentMetrics!.total_restaurants} Restaurants
                                </span>
                              </Show>
                            </div>
                          </Show>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0 ml-1">
                          <Show when={session.hasItinerary}>
                            <Sparkles class="w-3 h-3 text-accent" />
                          </Show>
                          <Show when={session.engagementMetrics}>
                            <div
                              class={`w-2 h-2 rounded-full ${
                                session.engagementMetrics!.engagement_level === "high"
                                  ? "bg-accent"
                                  : session.engagementMetrics!.engagement_level === "medium"
                                    ? "bg-primary"
                                    : "bg-muted-foreground"
                              }`}
                              title={`${session.engagementMetrics!.engagement_level} engagement`}
                            />
                          </Show>
                          <Show
                            when={
                              session.contentMetrics && session.contentMetrics.complexity_score >= 7
                            }
                          >
                            <div
                              class="w-1.5 h-1.5 bg-primary rounded-full"
                              title="Complex session"
                            />
                          </Show>
                        </div>
                      </div>
                      <p class="text-xs text-muted-foreground truncate mb-1 sm:mb-2 leading-relaxed">
                        {session.preview}
                      </p>
                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <span class="text-xs">{formatTimestamp(session.timestamp)}</span>
                        <div class="flex items-center gap-2">
                          <Show
                            when={
                              session.performanceMetrics &&
                              session.performanceMetrics.avg_response_time_ms > 0
                            }
                          >
                            <span
                              class="text-xs hidden sm:inline"
                              title={`Avg response: ${session.performanceMetrics!.avg_response_time_ms}ms`}
                            >
                              ⚡{" "}
                              {Math.round(session.performanceMetrics!.avg_response_time_ms / 1000)}s
                            </span>
                          </Show>
                          <span class="text-xs hidden sm:inline">
                            {session.messageCount} messages
                          </span>
                          <span class="text-xs sm:hidden">{session.messageCount}m</span>
                          <Show when={session.hasItinerary}>
                            <span class="text-xs text-accent hidden sm:inline">• Itinerary</span>
                          </Show>
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatSidebar;
