import { Component, createEffect, createSignal, Show, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Badge } from "@/ui/badge";
import { useMainPageStatistics, type MainPageStatistics } from "~/lib/api/statistics";
import { TrendingUp, Users, MapPin, Calendar, WifiOff } from "lucide-solid";

interface StatItem {
  value: string;
  label: string;
  icon?: Component;
  trend?: number; // Percentage change
}

interface RealTimeStatsProps {
  badgeText: string;
}

// Utility function to format numbers with commas
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

// Utility function to animate number changes
const animateNumber = (
  from: number,
  to: number,
  duration: number = 1000,
  callback: (value: number) => void,
) => {
  const startTime = Date.now();
  const difference = to - from;

  const updateNumber = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out animation
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + difference * easeOut);

    callback(current);

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  };

  requestAnimationFrame(updateNumber);
};

export default function RealTimeStats(props: RealTimeStatsProps) {
  const statsQuery = useMainPageStatistics();
  const [currentStats, setCurrentStats] = createSignal<MainPageStatistics | null>(null);
  const [animatedUsers, setAnimatedUsers] = createSignal(0);
  const [animatedItineraries, setAnimatedItineraries] = createSignal(0);
  const [animatedPOIs, setAnimatedPOIs] = createSignal(0);
  const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = createSignal(false);
  const isLoading = () => statsQuery.isLoading && !hasLoadedOnce();
  const hasError = () => Boolean(statsQuery.error);

  // Update stats when polling data arrives
  createEffect(() => {
    const data = statsQuery.data;
    if (!data) return;

    const previous = currentStats();
    setCurrentStats(data);
    setLastUpdate(new Date());
    setHasLoadedOnce(true);

    if (previous) {
      if (previous.total_users_count !== data.total_users_count) {
        animateNumber(previous.total_users_count, data.total_users_count, 1200, setAnimatedUsers);
      }
      if (previous.total_itineraries_saved !== data.total_itineraries_saved) {
        animateNumber(
          previous.total_itineraries_saved,
          data.total_itineraries_saved,
          1200,
          setAnimatedItineraries,
        );
      }
      if (previous.total_unique_pois !== data.total_unique_pois) {
        animateNumber(previous.total_unique_pois, data.total_unique_pois, 1200, setAnimatedPOIs);
      }
    } else {
      setAnimatedUsers(data.total_users_count);
      setAnimatedItineraries(data.total_itineraries_saved);
      setAnimatedPOIs(data.total_unique_pois);
    }
  });

  const stats = () => currentStats();

  const statsItems = (): StatItem[] => {
    const data = stats() ?? {
      total_users_count: 74210,
      total_itineraries_saved: 18120,
      total_unique_pois: 52040,
    };

    // Use data to show real stats when available
    void data; // Ensure data is used

    return [
      {
        value: formatNumber(animatedUsers()),
        label: "Users registered",
        icon: Users,
      },
      {
        value: formatNumber(animatedItineraries()),
        label: "Personalized Itineraries Saved",
        icon: Calendar,
      },
      {
        value: formatNumber(animatedPOIs()),
        label: "Unique Points of Interest",
        icon: MapPin,
      },
    ];
  };

  return (
    <section
      class="w-full py-20 sm:py-24 md:py-28 lg:py-32 relative overflow-hidden"
      aria-labelledby="stats-heading"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-gray-50/30 dark:bg-slate-900/20"
        aria-hidden="true"
      />
      <div class="container text-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="flex items-center justify-center gap-2 mb-6 sm:mb-8">
          <Badge class="bg-gradient-to-r from-blue-600 to-cyan-600 dark:bg-[#0c7df2] hover:from-blue-700 hover:to-cyan-700 dark:hover:bg-[#0a6ed6] text-white font-semibold px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm shadow-lg border border-blue-300/40 dark:border-white/20">
            {props.badgeText}
          </Badge>

          <Show
            when={!hasError()}
            fallback={
              <div class="flex items-center gap-1 text-red-600 dark:text-red-400">
                <WifiOff class="w-4 h-4" />
                <span class="text-xs font-medium">Offline view</span>
              </div>
            }
          >
            <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <div class="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span class="text-xs font-semibold">Refreshed twice daily</span>
            </div>
          </Show>
        </div>

        <h2 id="stats-heading" class="sr-only">
          Platform Statistics
        </h2>

        <Show
          when={!isLoading()}
          fallback={
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
              <For each={[1, 2, 3]}>
                {() => (
                  <div class="text-center" role="listitem">
                    <div class="h-12 sm:h-16 md:h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                )}
              </For>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto" role="list">
            <For each={statsItems()}>
              {(stat) => (
                <div
                  class="loci-card loci-card-interactive group text-center px-4 py-6 sm:px-6 sm:py-8 duration-300"
                  role="listitem"
                >
                  <div class="flex flex-col items-center">
                    <Show when={stat.icon}>
                      <div class="mb-3 p-3 bg-cyan-100 dark:bg-cyan-900/40 rounded-full group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/60 transition-colors shadow-sm">
                        <Dynamic
                          component={stat.icon}
                          {...({ class: "w-6 h-6 text-cyan-700 dark:text-cyan-300" } as any)}
                        />
                      </div>
                    </Show>

                    <p class="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2 transition-all duration-500 tracking-tight">
                      {stat.value}
                    </p>

                    <p class="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-tight px-2 sm:px-0 font-medium">
                      {stat.label}
                    </p>

                    <Show when={stat.trend}>
                      <div class="flex items-center gap-1 mt-1">
                        <TrendingUp class="w-3 h-3 text-green-500" />
                        <span class="text-xs text-green-600 dark:text-green-400 font-medium">
                          +{stat.trend}%
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={lastUpdate()}>
          <p class="text-xs text-gray-600 dark:text-slate-400 mt-4 font-medium">
            Last updated: {lastUpdate()?.toLocaleTimeString()}
          </p>
        </Show>
      </div>
    </section>
  );
}
