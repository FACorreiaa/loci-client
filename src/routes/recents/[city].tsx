import { createSignal, For, Show } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  MapPin,
  Clock,
  MessageCircle,
  TrendingUp,
  Building,
  Coffee,
  Share2,
  Bookmark,
} from "lucide-solid";
import { useCityDetails } from "~/lib/api/recents";
import type { RecentInteraction } from "~/lib/api/types";

export default function CityDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal("overview"); // 'overview' | 'interactions'

  const cityName = () => decodeURIComponent(params.city || "");
  const cityDetailsQuery = useCityDetails(cityName());

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    if (diffInHours < 48) return "Yesterday";
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;

    return date.toLocaleDateString();
  };

  const renderInteractionCard = (interaction: RecentInteraction) => (
    <div class="bg-card rounded-lg shadow-sm border border-border p-4 hover:shadow-md transition-all duration-200">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <MessageCircle class="w-5 h-5 text-primary" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-foreground text-sm mb-1">Chat Interaction</h3>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock class="w-3 h-3" />
                <span>{formatDate(interaction.created_at)}</span>
                <span>•</span>
                <span>{interaction.model_used}</span>
                <Show when={interaction.latency_ms}>
                  <span>•</span>
                  <span>{interaction.latency_ms}ms</span>
                </Show>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">Your Question:</p>
              <p class="text-sm text-foreground bg-muted rounded-lg p-2">{interaction.prompt}</p>
            </div>

            <Show when={interaction.response_text}>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">AI Response:</p>
                <p class="text-sm text-muted-foreground line-clamp-3">
                  {interaction.response_text}
                </p>
              </div>
            </Show>

            {/* Results Summary */}
            <div class="flex items-center gap-4 pt-2 border-t border-border">
              <Show when={interaction.pois && interaction.pois.length > 0}>
                <div class="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin class="w-3 h-3" />
                  <span>{interaction.pois.length} places</span>
                </div>
              </Show>
              <Show when={interaction.hotels && interaction.hotels.length > 0}>
                <div class="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building class="w-3 h-3" />
                  <span>{interaction.hotels.length} hotels</span>
                </div>
              </Show>
              <Show when={interaction.restaurants && interaction.restaurants.length > 0}>
                <div class="flex items-center gap-1 text-xs text-muted-foreground">
                  <Coffee class="w-3 h-3" />
                  <span>{interaction.restaurants.length} restaurants</span>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div class="min-h-screen bg-background relative transition-colors">
      {/* Header */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center gap-4">
            <button
              onClick={() => navigate("/recents")}
              class="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Back to recent activity"
            >
              <ArrowLeft class="w-5 h-5 text-muted-foreground" />
            </button>

            <div class="flex-1 min-w-0">
              <h1 class="text-xl sm:text-2xl font-bold text-foreground truncate">{cityName()}</h1>
              <Show when={cityDetailsQuery.data}>
                <p class="text-sm text-muted-foreground mt-1">
                  {cityDetailsQuery.data?.interactions?.length || 0} interaction
                  {(cityDetailsQuery.data?.interactions?.length || 0) !== 1 ? "s" : ""}
                </p>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <button class="p-2 hover:bg-muted rounded-lg transition-colors">
                <Share2 class="w-5 h-5 text-muted-foreground" />
              </button>
              <button class="p-2 hover:bg-muted rounded-lg transition-colors">
                <Bookmark class="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab("overview")}
              class={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab() === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("interactions")}
              class={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab() === "interactions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Interactions ({cityDetailsQuery.data?.interactions.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show when={cityDetailsQuery.isLoading}>
          <div class="flex items-center justify-center py-12">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span class="text-muted-foreground">Loading city details...</span>
            </div>
          </div>
        </Show>

        <Show when={cityDetailsQuery.isError}>
          <div class="text-center py-12">
            <div class="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp class="w-6 h-6 text-destructive" />
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Unable to load city details</h3>
            <p class="text-muted-foreground mb-4">Please try again later</p>
            <button
              onClick={() => cityDetailsQuery.refetch()}
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </Show>

        {/* A city this account has no recent activity in: a stale link, a
            renamed city, or someone else's URL. Say so rather than render an
            empty page of zeros. */}
        <Show when={cityDetailsQuery.isSuccess && !cityDetailsQuery.data}>
          <div class="text-center py-12">
            <MapPin class="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 class="text-lg font-semibold text-foreground mb-2">
              Nothing recent in {cityName()}
            </h3>
            <p class="text-muted-foreground mb-4">
              We couldn&apos;t find any recent activity for this city.
            </p>
            <A
              href="/recents"
              class="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to recent activity
            </A>
          </div>
        </Show>

        <Show when={cityDetailsQuery.isSuccess && cityDetailsQuery.data}>
          {/* Overview Tab */}
          <Show when={activeTab() === "overview"}>
            <div class="space-y-6">
              {/* Recent Activity Timeline */}
              <div class="bg-card rounded-lg shadow-sm border border-border p-6">
                <h2 class="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
                <div class="space-y-4">
                  <For each={cityDetailsQuery.data?.interactions?.slice(0, 3) || []}>
                    {(interaction) => (
                      <div class="flex items-start gap-3">
                        <div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-foreground font-medium">
                            {interaction.prompt.slice(0, 80)}
                            {interaction.prompt.length > 80 ? "..." : ""}
                          </p>
                          <p class="text-xs text-muted-foreground mt-1">
                            {formatDate(interaction.created_at)}
                          </p>
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={(cityDetailsQuery.data?.interactions?.length || 0) > 3}>
                    <button
                      onClick={() => setActiveTab("interactions")}
                      class="text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      View all {cityDetailsQuery.data?.interactions?.length || 0} interactions →
                    </button>
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          {/* Interactions Tab */}
          <Show when={activeTab() === "interactions"}>
            <div class="space-y-4">
              <For each={cityDetailsQuery.data?.interactions || []}>
                {(interaction) => renderInteractionCard(interaction)}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
