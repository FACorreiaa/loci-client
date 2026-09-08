import { createSignal, For, Show } from "solid-js";
import {
  Heart,
  MapPin,
  Clock,
  Search,
  Grid,
  List,
  Share2,
  Download,
  Trash2,
  Plus,
  SortAsc,
  SortDesc,
} from "lucide-solid";
import { useFavoritesList, useRemoveFromFavorites } from "~/lib/api/favorites";
import { Button } from "~/ui/button";
import { ErrorView } from "~/components/ErrorView";
import { TextField, TextFieldRoot } from "~/ui/textfield";

// Local type for favorites with additional UI fields
interface FavoriteDisplay {
  id: string;
  name: string;
  description_poi?: string;
  description?: string;
  category: string;
  address?: string;
  phone_number?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  opening_hours?: string;
}

export default function FavoritesPage() {
  const [viewMode, setViewMode] = createSignal("grid"); // 'grid', 'list'
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal("all");
  const [sortBy, setSortBy] = createSignal("name"); // 'name' or 'category'
  const [sortOrder, setSortOrder] = createSignal("asc"); // 'asc', 'desc'
  const [selectedPOIs, setSelectedPOIs] = createSignal<string[]>([]);

  // API hooks using new FavoritesService
  const favoritesQuery = useFavoritesList();
  const removeFavoriteMutation = useRemoveFromFavorites();

  // Transform favorites from API to display format
  const favorites = (): FavoriteDisplay[] => {
    const data = favoritesQuery.data;
    if (!data || !data.favorites) return [];
    return data.favorites.map((fav) => ({
      id: fav.itemId,
      name: fav.itemName,
      description_poi: fav.description,
      description: fav.description,
      category: fav.category || "Place",
      address: "",
      latitude: fav.latitude,
      longitude: fav.longitude,
    }));
  };

  // Dynamic categories based on actual data
  const categories = () => {
    const allCategories = favorites()
      .map((fav) => fav.category)
      .filter(Boolean);
    const uniqueCategories = [...new Set(allCategories)];
    const categoryCounts = uniqueCategories.map((cat) => ({
      id: cat.toLowerCase(),
      label: cat,
      count: favorites().filter((fav) => fav.category === cat).length,
    }));

    return [{ id: "all", label: "All Categories", count: favorites().length }, ...categoryCounts];
  };

  const sortOptions = [
    { id: "name", label: "Name" },
    { id: "category", label: "Category" },
  ];

  // Filter and sort favorites
  const filteredFavorites = () => {
    let filtered = favorites();

    // Search filter
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(
        (fav) =>
          fav.name?.toLowerCase().includes(query) ||
          fav.description_poi?.toLowerCase().includes(query) ||
          fav.category?.toLowerCase().includes(query) ||
          fav.address?.toLowerCase().includes(query),
      );
    }

    // Category filter
    if (selectedCategory() !== "all") {
      filtered = filtered.filter((fav) => fav.category?.toLowerCase() === selectedCategory());
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      switch (sortBy()) {
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "category":
          aVal = a.category?.toLowerCase() || "";
          bVal = b.category?.toLowerCase() || "";
          break;
        default:
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
      }

      if (sortOrder() === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const togglePOISelection = (poiId: string) => {
    setSelectedPOIs((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  };

  const clearSelection = () => {
    setSelectedPOIs([]);
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      Restaurant: "text-accent bg-accent/10",
      Park: "text-primary bg-primary/10",
      Beach: "text-primary bg-primary/10",
      Landmark: "text-accent bg-accent/10",
      "Religious Site": "text-primary bg-primary/10",
      Museum: "text-accent bg-accent/10",
      Shopping: "text-primary bg-primary/10",
    };
    return colorMap[category] || "text-muted-foreground bg-muted";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Restaurant":
        return "🍽️";
      case "Park":
        return "🌳";
      case "Beach":
        return "🏖️";
      case "Landmark":
        return "🏛️";
      case "Religious Site":
        return "⛪";
      case "Museum":
        return "🏛️";
      case "Shopping":
        return "🛍️";
      default:
        return "📍";
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      await removeFavoriteMutation.mutateAsync({
        itemId: favoriteId,
        contentType: "poi",
      });
    } catch (error) {
      console.error("Failed to remove favorite:", error);
    }
  };

  console.log("favorites", favorites);

  const renderGridCard = (favorite: FavoriteDisplay) => (
    <div class="cb-card group hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Image */}
      <div class="relative h-40 bg-muted border-b border-border overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center text-6xl">
          {getCategoryIcon(favorite.category)}
        </div>

        {/* Selection checkbox */}
        <div class="absolute top-3 left-3">
          <input
            type="checkbox"
            checked={selectedPOIs().includes(favorite.id)}
            onChange={() => togglePOISelection(favorite.id)}
            class="w-4 h-4 accent-primary rounded border-border focus:ring-ring"
          />
        </div>

        {/* Action buttons */}
        <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div class="flex gap-1">
            <button class="p-1.5 bg-card/90 text-foreground rounded-lg hover:bg-muted">
              <Share2 class="w-3 h-3" />
            </button>
            <button
              onClick={() => removeFavorite(favorite.id)}
              class="p-1.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Category badge */}
        <div class="absolute bottom-3 left-3">
          <span
            class={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(favorite.category)}`}
          >
            {favorite.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div class="p-4">
        <div class="mb-3">
          <h3 class="font-semibold text-foreground text-base mb-1 line-clamp-2">{favorite.name}</h3>
        </div>

        <p class="text-sm text-muted-foreground mb-4 line-clamp-3">
          {favorite.description_poi || favorite.description}
        </p>

        {/* Location details */}
        <div class="space-y-2 text-sm text-muted-foreground mb-4">
          <Show when={favorite.address}>
            <div class="flex items-start gap-2">
              <MapPin class="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span class="line-clamp-2">{favorite.address}</span>
            </div>
          </Show>
          <Show when={favorite.phone_number}>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 text-center">📞</span>
              <span>{favorite.phone_number}</span>
            </div>
          </Show>
          <Show when={favorite.website}>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 text-center">🌐</span>
              <a
                href={favorite.website}
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:text-primary/80 truncate"
              >
                Visit Website
              </a>
            </div>
          </Show>
        </div>

        {/* Coordinates */}
        <div class="text-xs text-muted-foreground pt-2 border-t border-border">
          {favorite.latitude?.toFixed(4)}, {favorite.longitude?.toFixed(4)}
        </div>
      </div>
    </div>
  );

  const renderListItem = (favorite: FavoriteDisplay) => (
    <div class="cb-card hover:shadow-md transition-all duration-200">
      <div class="p-4 sm:p-6">
        <div class="flex items-start gap-4">
          {/* Selection checkbox */}
          <input
            type="checkbox"
            checked={selectedPOIs().includes(favorite.id)}
            onChange={() => togglePOISelection(favorite.id)}
            class="mt-1 w-4 h-4 accent-primary rounded border-border focus:ring-ring"
          />

          {/* Category icon */}
          <div class="w-16 h-16 bg-muted border border-border rounded-lg flex items-center justify-center text-3xl flex-shrink-0">
            {getCategoryIcon(favorite.category)}
          </div>

          {/* Content */}
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-foreground text-lg mb-1">{favorite.name}</h3>
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(favorite.category)}`}
                  >
                    {favorite.category}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div class="flex items-center gap-1 ml-4">
                <button class="p-2 text-muted-foreground hover:bg-muted rounded-lg">
                  <Share2 class="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeFavorite(favorite.id)}
                  class="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <p class="text-sm text-muted-foreground mb-4 leading-relaxed">
              {favorite.description_poi || favorite.description}
            </p>

            {/* Location and contact details */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <Show when={favorite.address}>
                <div class="flex items-start gap-2">
                  <MapPin class="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span class="line-clamp-2">{favorite.address}</span>
                </div>
              </Show>

              <Show when={favorite.phone_number}>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 text-center">📞</span>
                  <a href={`tel:${favorite.phone_number}`} class="hover:text-primary">
                    {favorite.phone_number}
                  </a>
                </div>
              </Show>

              <Show when={favorite.website}>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 text-center">🌐</span>
                  <a
                    href={favorite.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:text-primary/80 truncate"
                  >
                    Visit Website
                  </a>
                </div>
              </Show>

              <div class="flex items-center gap-2">
                <span class="w-4 h-4 text-center">📍</span>
                <span class="text-xs text-muted-foreground">
                  {favorite.latitude?.toFixed(4)}, {favorite.longitude?.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Opening hours if available */}
            <Show when={favorite.opening_hours}>
              <div class="mt-3 pt-3 border-t border-border">
                <div class="flex items-start gap-2 text-sm text-muted-foreground">
                  <Clock class="w-4 h-4 mt-0.5" />
                  <div>
                    <p class="font-medium text-foreground mb-1">Opening Hours</p>
                    <p>{favorite.opening_hours}</p>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div class="min-h-screen relative transition-colors">
      {/* Header */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="loci-hero">
          <div class="loci-hero__content p-6 sm:p-8 space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div class="absolute -inset-1 hero-glow blur-md opacity-80" />
                  <div class="loci-hero__icon">
                    <Heart class="w-6 h-6 fill-current" />
                  </div>
                </div>
                <div>
                  <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">My Favorites</h1>
                  <p class="loci-hero__subtitle text-sm mt-1">
                    {favorites().length} places you've saved
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="loci-hero__action px-4 py-2">
                  <Download class="w-4 h-4" />
                  Export
                </button>
                <button type="button" class="loci-hero__cta gap-2 px-4 py-2 rounded-xl">
                  <Plus class="w-4 h-4" />
                  Add Place
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div class="relative flex-1 max-w-md">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
              <TextFieldRoot class="w-full">
                <TextField
                  type="text"
                  placeholder="Search favorites..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="pl-10"
                />
              </TextFieldRoot>
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory()}
              onChange={(e) => setSelectedCategory(e.target.value)}
              class="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <For each={categories()}>
                {(category) => (
                  <option value={category.id}>
                    {category.label} ({category.count})
                  </option>
                )}
              </For>
            </select>

            {/* Sort */}
            <div class="flex items-center gap-2">
              <select
                value={sortBy()}
                onChange={(e) => setSortBy(e.target.value)}
                class="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <For each={sortOptions}>
                  {(option) => <option value={option.id}>{option.label}</option>}
                </For>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                class="p-2 border border-border rounded-lg hover:bg-muted text-foreground"
              >
                {sortOrder() === "asc" ? <SortAsc class="w-4 h-4" /> : <SortDesc class="w-4 h-4" />}
              </button>
            </div>

            {/* View mode */}
            <div class="flex items-center border border-border rounded-lg p-1 bg-card">
              <button
                onClick={() => setViewMode("grid")}
                class={`p-2 rounded ${viewMode() === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Grid class="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                class={`p-2 rounded ${viewMode() === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <List class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bulk actions */}
          <Show when={selectedPOIs().length > 0}>
            <div class="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div class="flex items-center justify-between">
                <span class="text-sm text-primary dark:text-primary">
                  {selectedPOIs().length} item
                  {selectedPOIs().length > 1 ? "s" : ""} selected
                </span>
                <div class="flex items-center gap-2">
                  <button class="text-sm text-primary hover:text-primary dark:text-primary dark:hover:text-primary">
                    Add to List
                  </button>
                  <button class="text-sm text-primary hover:text-primary dark:text-primary dark:hover:text-primary">
                    Export Selected
                  </button>
                  <button class="text-sm text-destructive hover:text-destructive/80">
                    Remove Selected
                  </button>
                  <button
                    onClick={clearSelection}
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show
          when={filteredFavorites().length > 0}
          fallback={
            <Show
              when={favoritesQuery.isError}
              fallback={
                <div class="text-center py-12">
                  <Heart class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 class="text-lg font-semibold text-foreground mb-2">No favorites found</h3>
                  <p class="text-muted-foreground mb-4">
                    {searchQuery() || selectedCategory() !== "all"
                      ? "Try adjusting your search or filters"
                      : "Start exploring and save places you love!"}
                  </p>
                  <Button>Discover Places</Button>
                </div>
              }
            >
              <ErrorView
                error={favoritesQuery.error}
                onRetry={() => favoritesQuery.refetch()}
                class="my-6"
              />
            </Show>
          }
        >
          <div
            class={
              viewMode() === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                : "space-y-4"
            }
          >
            <For each={filteredFavorites()}>
              {(favorite) =>
                viewMode() === "grid" ? renderGridCard(favorite) : renderListItem(favorite)
              }
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
