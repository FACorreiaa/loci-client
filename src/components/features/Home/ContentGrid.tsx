import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import { ArrowRight } from "lucide-solid";
import { For, JSX } from "solid-js";

interface ContentItem {
  logo: JSX.Element;
  title: string;
  description: string;
  tag: string;
  tagColorClass: string;
  imageUrl: string;
}

interface ContentGridProps {
  items: ContentItem[];
}

export default function ContentGrid(props: ContentGridProps) {
  return (
    <section
      class="w-full py-12 sm:py-16 md:py-20 lg:py-24 relative overflow-hidden"
      aria-labelledby="content-grid-heading"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-white/25 dark:bg-slate-900/30"
        aria-hidden="true"
      />
      <div class="container relative z-10 px-4 sm:px-6 lg:px-8">
        <h2 id="content-grid-heading" class="sr-only">
          Featured Content
        </h2>
        {/* Mobile-first filter buttons */}
        <div
          class="flex flex-wrap justify-center mb-8 sm:mb-10 md:mb-12 gap-2 sm:gap-3"
          role="tablist"
          aria-label="Content filters"
        >
          <Button
            variant="ghost"
            class="font-semibold text-cyan-600 dark:text-cyan-300 bg-white/60 dark:bg-slate-900/40 border border-white/40 dark:border-slate-800/70 rounded-full px-4 py-2 sm:px-5 shadow-sm"
            role="tab"
            aria-selected="true"
          >
            Trending
          </Button>
          <Button
            variant="ghost"
            class="text-muted-foreground text-sm sm:text-base px-3 py-2 sm:px-4 rounded-full hover:text-cyan-500"
            role="tab"
            aria-selected="false"
          >
            Insights{" "}
            <Badge class="ml-1 sm:ml-2 text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200 border-cyan-200/80 dark:border-cyan-700/70">
              New
            </Badge>
          </Button>
          <Button
            variant="ghost"
            class="text-muted-foreground text-sm sm:text-base px-3 py-2 sm:px-4 rounded-full hover:text-cyan-500"
            role="tab"
            aria-selected="false"
          >
            Predictions{" "}
            <Badge class="ml-1 sm:ml-2 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200 border-purple-200/80 dark:border-purple-700/70">
              New
            </Badge>
          </Button>
        </div>

        {/* Mobile-first responsive grid */}
        <div class="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <For each={props.items}>
            {(item, index) => (
              <Card
                class="loci-card-interactive overflow-hidden duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                role="listitem"
                aria-labelledby={`card-title-${index()}`}
              >
                <div
                  class="flex h-32 items-center justify-center bg-secondary/40 sm:h-36 md:h-40"
                  aria-hidden="true"
                >
                  <span class="text-muted-foreground text-3xl sm:text-4xl md:text-5xl">
                    {item.logo}
                  </span>
                </div>
                <CardHeader class="p-4 sm:p-6">
                  <CardTitle
                    id={`card-title-${index()}`}
                    class="text-base sm:text-lg leading-tight text-card-foreground tracking-tight"
                  >
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent class="p-4 pt-0 sm:p-6 sm:pt-0">
                  <CardDescription class="text-sm sm:text-base leading-relaxed mb-3 sm:mb-4 text-muted-foreground">
                    {item.description}
                  </CardDescription>
                  <Badge
                    variant="outline"
                    class={`font-semibold text-xs sm:text-sm border-current ${
                      item.tagColorClass.includes("blue")
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
                        : item.tagColorClass.includes("purple")
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {item.tag}
                  </Badge>
                </CardContent>
              </Card>
            )}
          </For>
        </div>

        {/* Mobile-optimized CTA button */}
        <div class="text-center mt-8 sm:mt-10 md:mt-12">
          <Button
            variant="outline"
            class="text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 border-white/40 dark:border-slate-800/70 bg-white/40 dark:bg-slate-900/40 text-foreground hover:border-cyan-400 hover:text-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
            aria-label="Explore all travel guides"
          >
            Explore All Guides{" "}
            <ArrowRight class="w-3 h-3 sm:w-4 sm:h-4 ml-1.5 sm:ml-2" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
