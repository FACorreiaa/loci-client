import { Component, createSignal, Show, For, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Send,
  Loader2,
  MapPin,
  Bookmark,
  Star,
  TrendingUp,
  Heart,
  Coffee,
  Calendar,
  Camera,
  Globe,
  ChevronRight,
  Sparkles,
  Settings,
  Clock,
  GitCompare,
} from "lucide-solid";
import { detectDomain } from "~/lib/api/llm";
import { createStreamingSession, getDomainRoute, streamingService } from "~/lib/chat-stream";
import type { StreamingSession, AiCityResponse, CityInteractions } from "~/lib/api/types";
import { useUserLocation } from "~/contexts/LocationContext";
import { useDefaultSearchProfile } from "~/lib/api/profiles";
import { useAuth } from "~/contexts/AuthContext";
import { useLandingPageStatistics } from "~/lib/api/statistics";
import { useRecentInteractions } from "~/lib/api/recents";
import { useTrendingDiscoveries } from "~/lib/api/discover";
import { useFavoritesList } from "~/lib/api/favorites";
import QuickSettingsModal from "~/components/modals/QuickSettingsModal";
import ProfileQuickSelect from "./ProfileQuickSelect";

interface QuickDiscovery {
  id: string;
  icon: Component<{ class?: string }>;
  title: string;
  subtitle: string;
  route: string;
  tone: string;
}

interface RecentActivity {
  id: string;
  type: "itinerary" | "restaurant" | "hotel" | "activity";
  title: string;
  location: string;
  timestamp: string;
  saved: boolean;
}

export default function LoggedInDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentMessage, setCurrentMessage] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [streamProgress, setStreamProgress] = createSignal("");
  const [_streamingSession, setStreamingSession] = createSignal<StreamingSession | null>(null);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = createSignal(false);

  const { userLocation } = useUserLocation() as any;
  const userLatitude = userLocation()?.latitude || 38.7223;
  const userLongitude = userLocation()?.longitude || -9.1393;

  // Get default search profile
  const defaultProfileQuery = useDefaultSearchProfile();

  const profileId = () => defaultProfileQuery.data?.id;

  // Get user statistics (only if user is authenticated)
  const userStatsQuery = useLandingPageStatistics();

  // Get recent interactions from API
  const recentInteractionsQuery = useRecentInteractions(5);

  // Get trending discoveries
  const trendingQuery = useTrendingDiscoveries(5);

  // Get favorites count
  const favoritesQuery = useFavoritesList();

  // Compute total saved places (favorites + bookmarks from stats)
  const savedPlacesCount = createMemo(() => {
    const favCount = favoritesQuery.data?.items?.length || 0;
    const statsCount = userStatsQuery.data?.saved_places || 0;
    // Return whichever is higher to avoid double counting
    // In future, backend should return combined count
    return Math.max(favCount, statsCount);
  });

  // Helper function to format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Map recent interactions to activity items
  const recentActivities = createMemo(() => {
    const cities = recentInteractionsQuery.data?.cities || [];
    const activities: RecentActivity[] = [];

    cities.forEach((city: CityInteractions) => {
      city.interactions?.slice(0, 3).forEach((interaction) => {
        // Determine type based on content
        let activityType: "itinerary" | "restaurant" | "hotel" | "activity" = "itinerary";
        if (interaction.hotels?.length > 0) activityType = "hotel";
        else if (interaction.restaurants?.length > 0) activityType = "restaurant";
        else if (interaction.pois?.length > 0) activityType = "activity";

        activities.push({
          id: interaction.id,
          type: activityType,
          title: interaction.prompt?.slice(0, 50) || city.city_name,
          location: city.city_name,
          timestamp: formatRelativeTime(interaction.created_at),
          saved: false,
        });
      });
    });

    return activities.slice(0, 5);
  });

  // Quick discoveries - navigate to /discover with category
  const quickDiscoveries: QuickDiscovery[] = [
    {
      id: "discover-nearby",
      icon: MapPin,
      title: "Discover Nearby",
      subtitle: "Find hidden gems around you",
      route: "/discover?category=nearby",
      tone: "bg-primary",
    },
    {
      id: "food-adventure",
      icon: Coffee,
      title: "Food Adventure",
      subtitle: "Culinary discoveries await",
      route: "/discover?category=dining",
      tone: "bg-[#f97316]",
    },
    {
      id: "cultural-tour",
      icon: Camera,
      title: "Cultural Tour",
      subtitle: "Museums, art, and history",
      route: "/discover?category=cultural",
      tone: "bg-[#4338ca]",
    },
    {
      id: "weekend-compare",
      icon: GitCompare,
      title: "Weekend compare",
      subtitle: "Évora vs Beja from Porto",
      route: "/compare",
      tone: "bg-accent",
    },
    {
      id: "weekend-plan",
      icon: Calendar,
      title: "Weekend Plan",
      subtitle: "Perfect 2-day getaway",
      route: "/discover?category=weekend",
      tone: "bg-emerald-600",
    },
  ];

  // Handle quick discovery click - navigate to discover page
  const handleQuickDiscovery = (discovery: QuickDiscovery) => {
    navigate(discovery.route);
  };

  const sendMessage = async () => {
    if (!currentMessage().trim() || isLoading()) return;

    setIsLoading(true);
    setStreamProgress("Analyzing your request...");

    try {
      // Clear any previous session data to ensure fresh start
      sessionStorage.removeItem("currentStreamingSession");
      sessionStorage.removeItem("completedStreamingSession");
      sessionStorage.removeItem("localChatSessions");

      // Detect domain from the message
      const domain = detectDomain(currentMessage());
      console.log("Detected domain:", domain);

      // Create streaming session
      const session = createStreamingSession(domain);
      session.query = currentMessage();
      setStreamingSession(session);

      // Store session in sessionStorage for persistence
      sessionStorage.setItem("currentStreamingSession", JSON.stringify(session));

      // Get current profile ID
      const currentProfileId = profileId();
      if (!currentProfileId) {
        throw new Error("No default search profile found");
      }

      // Set up streaming manager (the service owns the stream now).
      streamingService.startStream(
        {
          profileId: currentProfileId,
          message: currentMessage(),
          userLocation: {
            userLat: userLatitude,
            userLon: userLongitude,
          },
        },
        {
          session,
          onProgress: (updatedSession) => {
            setStreamingSession(updatedSession);
            const domain = updatedSession.domain;

            // Type guard or assertion for general_city_data
            const cityData = (updatedSession.data as Partial<AiCityResponse>)?.general_city_data;

            if (cityData) {
              setStreamProgress(`Found information about ${cityData.city}...`);
            } else if (domain === "accommodation") {
              setStreamProgress("Finding hotels...");
            } else if (domain === "dining") {
              setStreamProgress("Searching restaurants...");
            } else if (domain === "activities") {
              setStreamProgress("Discovering activities...");
            } else {
              setStreamProgress("Creating your itinerary...");
            }
            sessionStorage.setItem("currentStreamingSession", JSON.stringify(updatedSession));
          },
          onComplete: (completedSession) => {
            console.log("🎊 onComplete callback triggered in LoggedInDashboard", completedSession);
            setIsLoading(false);
            setStreamProgress("");
            setCurrentMessage("");

            // Store completed session
            sessionStorage.setItem("completedStreamingSession", JSON.stringify(completedSession));

            // Navigate to appropriate page
            const route = getDomainRoute(
              completedSession.domain,
              completedSession.sessionId,
              completedSession.city,
            );
            console.log("🧭 Navigation route:", route, {
              domain: completedSession.domain,
              sessionId: completedSession.sessionId,
              city: completedSession.city,
            });

            if (route) {
              console.log("✈️  Navigating to:", route);
              navigate(route);
            } else {
              console.error("❌ No route returned from getDomainRoute");
            }
          },
          onError: (error) => {
            console.error("Streaming error:", error);
            setIsLoading(false);
            setStreamProgress("");
          },
        },
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
      setStreamProgress("");
    }
  };

  // Delete handleQuickAction - replaced by handleQuickDiscovery

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "itinerary":
        return Calendar;
      case "restaurant":
        return Coffee;
      case "hotel":
        return MapPin;
      case "activity":
        return Star;
      default:
        return MapPin;
    }
  };

  const currentUser = user();
  const displayName =
    currentUser?.display_name || currentUser?.firstname || currentUser?.username || "Explorer";

  return (
    <div class="min-h-screen relative bg-gradient-to-br from-background via-muted/30 to-background text-foreground overflow-hidden">
      <div class="absolute inset-0 opacity-40 dark:opacity-60">
        <div class="domain-grid" aria-hidden="true" />
        <div class="domain-veil" aria-hidden="true" />
        <div class="domain-halo" aria-hidden="true" />
      </div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20 relative z-10">
        {/* Welcome Header */}
        <div class="mb-10">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="font-display text-3xl text-foreground tracking-tight">
                Welcome back, {displayName}
              </h1>
              <p class="text-muted-foreground mt-1">Ready to discover something amazing today?</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                onClick={() => setIsQuickSettingsOpen(true)}
                class="p-2 text-foreground hover:text-primary rounded-lg hover:bg-muted border border-border transition-colors"
                title="Quick Settings"
              >
                <Settings class="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
            <div class="loci-card rounded-xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Saved Places</p>
                  <p class="text-2xl font-bold text-foreground">
                    {userStatsQuery.isLoading && favoritesQuery.isLoading
                      ? "--"
                      : savedPlacesCount()}
                  </p>
                </div>
                <Bookmark class="w-8 h-8 text-primary" />
              </div>
            </div>
            <div class="loci-card rounded-xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Itineraries</p>
                  <p class="text-2xl font-bold text-foreground">
                    {userStatsQuery.isLoading ? "--" : (userStatsQuery.data?.itineraries ?? "0")}
                  </p>
                </div>
                <Calendar class="w-8 h-8 text-primary" />
              </div>
            </div>
            <div class="loci-card rounded-xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Cities Explored</p>
                  <p class="text-2xl font-bold text-foreground">
                    {userStatsQuery.isLoading
                      ? "--"
                      : (userStatsQuery.data?.cities_explored ?? "0")}
                  </p>
                </div>
                <Globe class="w-8 h-8 text-primary" />
              </div>
            </div>
            <div class="loci-card rounded-xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Discoveries</p>
                  <p class="text-2xl font-bold text-foreground">
                    {userStatsQuery.isLoading ? "--" : (userStatsQuery.data?.discoveries ?? "0")}
                  </p>
                </div>
                <Sparkles class="w-8 h-8 text-amber-600 dark:text-amber-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Search */}
        <div class="mb-10">
          <div class="loci-card rounded-2xl p-6 sm:p-8">
            <h2 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-primary" />
              What would you like to discover?
            </h2>

            {/* Profile Quick Select */}
            <ProfileQuickSelect />

            <div class="flex items-end gap-3">
              <div class="flex-1">
                <textarea
                  value={currentMessage()}
                  onInput={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Describe your perfect day, meal, or adventure..."
                  class="w-full h-12 px-4 py-3 border border-border rounded-xl resize-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground backdrop-blur"
                  rows="1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!currentMessage().trim() || isLoading()}
                class="px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-xl font-semibold transition-all flex items-center gap-2 disabled:cursor-not-allowed shadow-lg border border-primary/30"
              >
                <Show
                  when={isLoading()}
                  fallback={
                    <>
                      <Send class="w-4 h-4" />
                      Discover
                    </>
                  }
                >
                  <Loader2 class="w-4 h-4 animate-spin" />
                  {streamProgress() || "Processing..."}
                </Show>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Quick Actions */}
          <div class="lg:col-span-2">
            <h2 class="text-xl font-semibold text-foreground mb-5">Quick Discoveries</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              <For each={quickDiscoveries}>
                {(discovery) => (
                  <button
                    onClick={() => handleQuickDiscovery(discovery)}
                    class={`rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transform hover:translate-y-[-4px] transition-all duration-200 text-left group border border-white/20 backdrop-blur bg-gradient-to-br ${discovery.tone} from-white/8`}
                  >
                    <div class="flex items-start justify-between mb-3">
                      <discovery.icon class="w-8 h-8" />
                      <ChevronRight class="w-5 h-5 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-200" />
                    </div>
                    <h3 class="font-semibold text-lg mb-1">{discovery.title}</h3>
                    <p class="text-white/90 text-sm">{discovery.subtitle}</p>
                  </button>
                )}
              </For>
            </div>

            {/* Personalized Suggestions */}
            {/* Trending Destinations */}
            <Show when={trendingQuery.data && trendingQuery.data.length > 0}>
              <div class="loci-card rounded-2xl p-6">
                <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp class="w-5 h-5 text-primary" />
                  Trending Destinations
                </h3>
                <div class="space-y-4">
                  <For each={trendingQuery.data}>
                    {(trending) => (
                      <div
                        class="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group cursor-pointer"
                        onClick={() => {
                          setCurrentMessage(`Tell me about ${trending.city_name}`);
                          setTimeout(() => sendMessage(), 100);
                        }}
                      >
                        <div class="flex items-center gap-3">
                          <span class="text-2xl">{trending.emoji}</span>
                          <div>
                            <h4 class="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {trending.city_name}
                            </h4>
                            <p class="text-sm text-muted-foreground">
                              {trending.search_count} searches this week
                            </p>
                          </div>
                        </div>
                        <ChevronRight class="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          {/* Sidebar */}
          <div class="space-y-6">
            {/* Recent Activity */}
            <div class="loci-card p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-foreground">Recent Activity</h3>
                <button class="text-primary hover:text-primary/80 text-sm font-semibold">
                  View All
                </button>
              </div>
              <div class="space-y-3">
                <For each={recentActivities()}>
                  {(activity) => {
                    const IconComponent = getActivityIcon(activity.type);
                    return (
                      <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group border border-border">
                        <div class="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <IconComponent class="w-5 h-5 text-primary" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <h4 class="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                            {activity.title}
                          </h4>
                          <p class="text-xs text-muted-foreground truncate">{activity.location}</p>
                          <p class="text-xs text-muted-foreground/80">{activity.timestamp}</p>
                        </div>
                        <Show when={activity.saved}>
                          <Heart class="w-4 h-4 text-red-500 fill-current" />
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Quick Actions Sidebar */}
            <div class="loci-card p-6">
              <h3 class="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
              <div class="space-y-3">
                <button
                  onClick={() => navigate("/chat")}
                  class="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-muted transition-colors group border border-border"
                >
                  <div class="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Sparkles class="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 class="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      AI Chat
                    </h4>
                    <p class="text-xs text-muted-foreground">Chat with our AI assistant</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/lists")}
                  class="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-muted transition-colors group border border-border"
                >
                  <div class="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Calendar class="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 class="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      My Itineraries
                    </h4>
                    <p class="text-xs text-muted-foreground">View saved plans</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/lists?tab=favorites")}
                  class="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-muted transition-colors group border border-border"
                >
                  <div class="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Heart class="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 class="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      Saved Places
                    </h4>
                    <p class="text-xs text-muted-foreground">Your favorites</p>
                  </div>
                </button>
              </div>
            </div>

            {/* API Access Coming Soon Card */}
            <div class="rounded-2xl p-5 bg-foreground text-background border border-border backdrop-blur shadow-xl">
              <div class="flex items-start gap-3 mb-3">
                <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg
                    class="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h4 class="font-semibold text-background text-sm">API Access</h4>
                  <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-accent/20 text-accent text-[10px] font-medium rounded-full border border-accent/30">
                    <Clock class="w-2.5 h-2.5" />
                    Soon for Premium
                  </span>
                </div>
              </div>
              <p class="text-background/70 text-xs mb-3">
                Build custom integrations with our RESTful & gRPC API endpoints.
              </p>
              <button
                onClick={() => navigate("/pricing#api-access")}
                class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-background/10 hover:bg-background/20 text-background/80 hover:text-background rounded-lg text-xs font-medium transition-colors border border-background/20"
              >
                Learn More
                <ChevronRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Settings Modal */}
      <QuickSettingsModal
        isOpen={isQuickSettingsOpen()}
        onClose={() => setIsQuickSettingsOpen(false)}
      />
    </div>
  );
}
