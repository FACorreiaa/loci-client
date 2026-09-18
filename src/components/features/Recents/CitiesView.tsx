import { createSignal, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  Search,
  MapPin,
  Clock,
  Star,
  Filter,
  Grid,
  List,
  TrendingUp,
  Sparkles,
  RotateCcw,
  SortAsc,
  SortDesc,
  Bookmark,
  CheckSquare,
  Square,
} from "lucide-solid";
import { useRecentInteractions } from "~/lib/api/recents";
import type { CityInteractions } from "~/lib/api/types";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { useSelection, type SelectionItem } from "~/lib/hooks/useSelection";
import { SelectionToolbar } from "~/components/ui/SelectionToolbar";
import { exportPOIsToPDF } from "~/lib/utils/pdf-export";

/**
 * The explored-cities grid: the whole of what /recents used to be.
 *
 * It is kept, unchanged, as the page's second view. Grouping by city answers
 * "where have I been", which is a real question and the only thing
 * /recents/:city has to work from — it just is not the question the page leads
 * with any more.
 */
export default function CitiesView() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [viewMode, setViewMode] = createSignal("grid"); // 'grid', 'list'
  const [sortBy, setSortBy] = createSignal("recent"); // 'recent', 'alphabetical', 'activity_count'
  const [sortOrder, setSortOrder] = createSignal("desc");
  const [showFilters, setShowFilters] = createSignal(false);
  const [selectedTimeframe, setSelectedTimeframe] = createSignal("all"); // 'today', 'week', 'month', 'all'

  const navigate = useNavigate();
  const recentsQuery = useRecentInteractions(50); // Get more cities for better overview

  // Selection state for cities
  const selection = useSelection<SelectionItem>();

  // Convert city to selection item format
  const cityToSelectionItem = (city: CityInteractions): SelectionItem => ({
    id: city.city_name,
    name: city.city_name,
    category: "City",
    description: `${city.interactions.length} interactions, ${city.poi_count} places`,
  });

  // Handle city selection toggle
  const handleCitySelect = (city: CityInteractions, e: Event) => {
    e.stopPropagation();
    selection.toggleSelection(cityToSelectionItem(city));
  };

  // Handle export
  const handleExport = () => {
    const items = selection.getSelectedItems();
    exportPOIsToPDF(items, "Recent Cities");
  };

  // Select all filtered cities
  const handleSelectAll = () => {
    const items = filteredCities().map(cityToSelectionItem);
    selection.selectAll(items);
  };

  const timeframeOptions = [
    { id: "all", label: "All Time" },
    { id: "month", label: "This Month" },
    { id: "week", label: "This Week" },
    { id: "today", label: "Today" },
  ];

  const sortOptions = [
    { id: "recent", label: "Most Recent" },
    { id: "alphabetical", label: "Alphabetical" },
    { id: "activity_count", label: "Activity Count" },
  ];

  // Filter cities based on search query and timeframe
  const filteredCities = () => {
    if (!recentsQuery.data?.cities) return [];

    let filtered = [...(recentsQuery.data?.cities || [])];

    // Search filter
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter((city) => city.city_name.toLowerCase().includes(query));
    }

    // Timeframe filter
    if (selectedTimeframe() !== "all") {
      const now = new Date();
      const timeframes: Record<string, Date> = {
        today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getFullYear(), now.getMonth(), 1),
      };

      const cutoff = timeframes[selectedTimeframe()];
      if (cutoff) {
        filtered = filtered.filter((city) => new Date(city.last_activity) >= cutoff);
      }
    }

    // Sort
    const currentSortBy = sortBy();
    const currentSortOrder = sortOrder();

    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (currentSortBy) {
        case "alphabetical":
          aVal = a.city_name.toLowerCase();
          bVal = b.city_name.toLowerCase();
          break;
        case "activity_count":
          aVal = a.interactions.length;
          bVal = b.interactions.length;
          break;
        case "recent":
        default:
          aVal = new Date(a.last_activity);
          bVal = new Date(b.last_activity);
          break;
      }

      if (currentSortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

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

  const getActivityLevel = (interactionCount: number) => {
    if (interactionCount >= 10)
      return {
        level: "high",
        color: "text-destructive bg-destructive/10",
        icon: "🔥",
      };
    if (interactionCount >= 5)
      return {
        level: "medium",
        color: "text-accent bg-accent/10",
        icon: "⭐",
      };
    return {
      level: "low",
      color: "text-primary bg-primary/10",
      icon: "📍",
    };
  };

  const handleCityClick = (cityName: string) => {
    navigate(`/recents/${encodeURIComponent(cityName)}`);
  };

  const renderGridCard = (city: CityInteractions) => {
    const activityInfo = getActivityLevel(city.interactions.length);

    return (
      <div
        onClick={() => handleCityClick(city.city_name)}
        class="bg-card rounded-lg shadow-sm border border-border overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        {/* Header Image */}
        <div class="relative h-32 bg-muted/50 border-b border-border">
          <div class="absolute inset-0 flex items-center justify-center text-3xl">🏙️</div>

          {/* Activity Badge */}
          <div class="absolute top-3 left-3">
            <span class={`px-2 py-1 rounded-full text-xs font-medium ${activityInfo.color}`}>
              <span class="mr-1">{activityInfo.icon}</span>
              {activityInfo.level === "high"
                ? "Very Active"
                : activityInfo.level === "medium"
                  ? "Active"
                  : "Visited"}
            </span>
          </div>

          {/* Selection Checkbox */}
          <button
            onClick={(e) => handleCitySelect(city, e)}
            class="absolute top-3 right-3 p-1.5 bg-card/90 rounded-lg hover:bg-muted transition-colors z-10"
            title={selection.isSelected(city.city_name) ? "Deselect" : "Select"}
          >
            {selection.isSelected(city.city_name) ? (
              <CheckSquare class="w-4 h-4 text-primary" />
            ) : (
              <Square class="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        <div class="p-4">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-foreground text-lg mb-1 truncate">{city.city_name}</h3>
              <p class="text-sm text-muted-foreground">
                {city.interactions.length} interaction{city.interactions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div class="space-y-2 mb-3">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-1 text-muted-foreground">
                <MapPin class="w-3 h-3" />
                <span>{city.poi_count} places</span>
              </div>
              <div class="flex items-center gap-1 text-muted-foreground">
                <Clock class="w-3 h-3" />
                <span>{formatDate(city.last_activity)}</span>
              </div>
            </div>

            <Show when={(city.total_favorites || 0) > 0 || (city.total_itineraries || 0) > 0}>
              <div class="flex items-center gap-3 text-xs text-muted-foreground">
                <Show when={(city.total_favorites || 0) > 0}>
                  <div class="flex items-center gap-1">
                    <Star class="w-3 h-3 text-accent" />
                    <span>{city.total_favorites} favorites</span>
                  </div>
                </Show>
                <Show when={(city.total_itineraries || 0) > 0}>
                  <div class="flex items-center gap-1">
                    <Bookmark class="w-3 h-3 text-primary" />
                    <span>{city.total_itineraries} saved</span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Preview of recent activity */}
          <Show when={city.interactions.length > 0}>
            <div class="pt-3 border-t border-border">
              <p class="text-xs text-muted-foreground line-clamp-2">
                Latest: {city.interactions[0]?.prompt || "Recent activity"}
              </p>
            </div>
          </Show>
        </div>
      </div>
    );
  };

  const renderListItem = (city: CityInteractions) => {
    const activityInfo = getActivityLevel(city.interactions.length);

    return (
      <div
        onClick={() => handleCityClick(city.city_name)}
        class="bg-card rounded-lg shadow-sm border border-border p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div class="flex items-center gap-4">
          {/* City Icon */}
          <div class="w-12 h-12 bg-muted/50 border border-border rounded-lg flex items-center justify-center text-xl flex-shrink-0">
            🏙️
          </div>

          {/* Content */}
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-1">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-foreground text-base">{city.city_name}</h3>
                <p class="text-sm text-muted-foreground">
                  {city.interactions.length} interaction{city.interactions.length !== 1 ? "s" : ""}{" "}
                  • {city.poi_count} places
                  {(city.total_favorites || 0) > 0 && ` • ${city.total_favorites} favorites`}
                  {(city.total_itineraries || 0) > 0 && ` • ${city.total_itineraries} saved`}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class={`px-2 py-1 rounded-full text-xs font-medium ${activityInfo.color}`}>
                  <span class="mr-1">{activityInfo.icon}</span>
                  {activityInfo.level === "high"
                    ? "Very Active"
                    : activityInfo.level === "medium"
                      ? "Active"
                      : "Visited"}
                </span>
                <button
                  onClick={(e) => handleCitySelect(city, e)}
                  class="p-1 rounded hover:bg-muted transition-colors"
                  title={selection.isSelected(city.city_name) ? "Deselect" : "Select"}
                >
                  {selection.isSelected(city.city_name) ? (
                    <CheckSquare class="w-4 h-4 text-primary" />
                  ) : (
                    <Square class="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  )}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-4 text-sm text-muted-foreground">
              <div class="flex items-center gap-1">
                <Clock class="w-3 h-3" />
                <span>{formatDate(city.last_activity)}</span>
              </div>
              <Show when={city.interactions.length > 0}>
                <span class="truncate max-w-xs">
                  Latest: {city.interactions[0]?.prompt || "Recent activity"}
                </span>
              </Show>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div class="relative">
      {/* Search and Filters */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex flex-col gap-4">
            {/* Top row: Search */}
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Search */}
              <div class="relative flex-1 max-w-md">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <TextFieldRoot class="w-full">
                  <TextField
                    type="text"
                    placeholder="Search cities..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    class="pl-10"
                  />
                </TextFieldRoot>
              </div>

              {/* Mobile controls toggle */}
              <div class="flex items-center gap-2 sm:hidden">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters())}
                  class="gap-2"
                >
                  <Filter class="w-4 h-4" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Controls - Always visible on desktop, collapsible on mobile */}
            <div class={`${showFilters() ? "block" : "hidden"} sm:block`}>
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left side: Filters and Sort */}
                <div class="flex flex-wrap items-center gap-4">
                  {/* Timeframe Filter */}
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Time:
                    </label>
                    <select
                      value={selectedTimeframe()}
                      onChange={(e) => setSelectedTimeframe(e.target.value)}
                      class="min-w-[120px] px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                    >
                      <For each={timeframeOptions}>
                        {(option) => <option value={option.id}>{option.label}</option>}
                      </For>
                    </select>
                  </div>

                  {/* Sort Controls */}
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Sort by:
                    </label>
                    <div class="flex items-center gap-1">
                      <select
                        value={sortBy()}
                        onChange={(e) => setSortBy(e.target.value)}
                        class="min-w-[140px] px-3 py-2 border border-border rounded-l-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                      >
                        <For each={sortOptions}>
                          {(option) => <option value={option.id}>{option.label}</option>}
                        </For>
                      </select>
                      <button
                        onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                        class="p-2 border border-l-0 border-border rounded-r-lg hover:bg-muted bg-card transition-colors"
                        title={`Sort ${sortOrder() === "asc" ? "Descending" : "Ascending"}`}
                      >
                        {sortOrder() === "asc" ? (
                          <SortAsc class="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <SortDesc class="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right side: View mode toggle */}
                <div class="flex items-center gap-2">
                  <label class="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    View:
                  </label>
                  <div class="flex items-center border border-border rounded-lg p-1 bg-card">
                    <button
                      onClick={() => setViewMode("grid")}
                      class={`p-2 rounded transition-colors ${viewMode() === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      title="Grid view"
                    >
                      <Grid class="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      class={`p-2 rounded transition-colors ${viewMode() === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      title="List view"
                    >
                      <List class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show when={recentsQuery.isLoading}>
          <div class="flex items-center justify-center py-12">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span class="text-muted-foreground">Loading your recent activity...</span>
            </div>
          </div>
        </Show>

        <Show when={recentsQuery.isError}>
          <div class="text-center py-12">
            <div class="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp class="w-6 h-6 text-destructive" />
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">
              Unable to load recent activity
            </h3>
            <p class="text-muted-foreground mb-4">Please try again later</p>
            <Button onClick={() => recentsQuery.refetch()}>Try Again</Button>
          </div>
        </Show>

        <Show when={recentsQuery.isSuccess}>
          <Show
            when={filteredCities().length > 0}
            fallback={
              <div class="text-center py-12">
                <RotateCcw class="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 class="text-lg font-semibold text-foreground mb-2">
                  {searchQuery() || selectedTimeframe() !== "all"
                    ? "No cities found"
                    : "No recent activity"}
                </h3>
                <p class="text-muted-foreground mb-4">
                  {searchQuery() || selectedTimeframe() !== "all"
                    ? "Try adjusting your search or time filter"
                    : "Start exploring cities to see your activity here!"}
                </p>
                <Show when={!searchQuery() && selectedTimeframe() === "all"}>
                  <A
                    href="/discover"
                    class="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles class="w-4 h-4" />
                    Start Exploring
                  </A>
                </Show>
              </div>
            }
          >
            <div class="flex items-center justify-between mb-6">
              <p class="text-muted-foreground">
                {filteredCities().length} cit{filteredCities().length !== 1 ? "ies" : "y"} found
              </p>
            </div>

            <div
              class={
                viewMode() === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              <For each={filteredCities()}>
                {(city) => (viewMode() === "grid" ? renderGridCard(city) : renderListItem(city))}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Selection Toolbar */}
      <SelectionToolbar
        count={selection.count()}
        onExport={handleExport}
        onClear={selection.clearSelection}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
