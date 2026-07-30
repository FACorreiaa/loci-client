import { createSignal, For } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { Search, MapPin, Star, Sparkles } from "lucide-solid";
import { TOKYO_HOTELS, TOKYO_RESTAURANTS, TOKYO_ACTIVITIES } from "~/data/preview-data";
import FavoriteButton from "~/components/shared/FavoriteButton";
import { Button } from "~/ui/button";

export default function PreviewDiscoverPage() {
  const [searchQuery, setSearchQuery] = createSignal("Best things to do in Tokyo");
  const [searchResults] = createSignal([
    ...TOKYO_ACTIVITIES,
    ...TOKYO_RESTAURANTS,
    ...TOKYO_HOTELS,
  ]);

  const handleSearch = (e: Event) => {
    e.preventDefault();
    alert("This is a preview with Tokyo data. Sign in to search the world!");
  };

  return (
    <>
      <Title>Discover Preview - Loci</Title>
      <Meta name="robots" content="noindex" />

      <div class="min-h-screen relative transition-colors">
        {/* Header */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="loci-hero">
            <div class="loci-hero__content p-6 sm:p-8 space-y-6">
              <span class="loci-chip uppercase tracking-wide text-[10px] sm:text-xs">
                Live Preview
              </span>
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div class="absolute -inset-1 hero-glow blur-md opacity-80" />
                  <div class="loci-hero__icon">
                    <Sparkles class="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">Discover</h1>
                  <p class="loci-hero__subtitle text-sm mt-1">
                    AI-curated routes, fresh drops, and local pulse in one place.
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div class="loci-card p-6">
                <form onSubmit={handleSearch} class="relative">
                  <div class="flex flex-col md:flex-row gap-4">
                    <div class="flex-1 relative">
                      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                      <input
                        type="text"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border focus:ring-2 focus:ring-ring focus:border-ring bg-card/95 text-foreground placeholder:text-muted-foreground text-base transition-all"
                      />
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        value="Tokyo, Japan"
                        readOnly
                        class="px-4 py-3 rounded-xl border-2 border-border bg-card/95 text-foreground w-40 md:w-48 backdrop-blur"
                      />
                      <Button type="submit" class="gap-2">
                        <Search class="w-5 h-5" />
                        Search
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Results */}
          <div class="mb-10">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-foreground">Preview Results: Tokyo</h2>
              <p class="text-sm text-muted-foreground">{searchResults().length} places</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={searchResults()}>
                {(poi) => (
                  <div class="loci-card loci-card-interactive p-4 duration-200 cursor-pointer">
                    <div class="flex items-start justify-between gap-3 mb-2">
                      <div class="flex-1">
                        <h3 class="text-base font-semibold text-foreground">{poi.name}</h3>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {poi.category}
                          </span>
                          <span class="text-xs text-muted-foreground">{poi.price_level}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <FavoriteButton
                          item={{
                            id: poi.name,
                            name: poi.name,
                            contentType: "poi",
                            description: poi.description,
                          }}
                          size="sm"
                          // Mock functionality
                          onClick={(e: Event) => {
                            e.preventDefault();
                            alert("Sign in to save favorites!");
                          }}
                        />
                      </div>
                    </div>
                    <p class="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {poi.description}
                    </p>
                    <div class="flex items-center gap-3 text-xs text-muted-foreground">
                      <div class="flex items-center gap-1">
                        <Star class="w-4 h-4 text-primary fill-current" />
                        <span class="font-medium">{poi.rating}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <MapPin class="w-4 h-4 text-primary" />
                        <span class="font-medium">{poi.address}</span>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
