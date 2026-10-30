import { Component, Show } from "solid-js";
import { MapPin, ArrowRight } from "lucide-solid";

interface CityInfoHeaderProps {
  city?: string;
  description?: string;
  weather?: string;
  onPlanTrip?: () => void;
  loading?: boolean;
}

export const CityInfoHeader: Component<CityInfoHeaderProps> = (props) => {
  return (
    <div class="relative overflow-hidden rounded-3xl bg-card p-8 shadow-sm ring-1 ring-border mb-6">
      <div class="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-holo/10 blur-3xl" />
      <div class="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div class="relative z-10">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 text-primary">
            <MapPin class="h-5 w-5" />
            <span class="text-sm font-semibold uppercase tracking-wider">Destination</span>
          </div>

          <Show
            when={!props.loading}
            fallback={<div class="h-10 w-48 bg-muted rounded animate-pulse" />}
          >
            <h1 class="text-4xl font-bold text-foreground sm:text-5xl">
              {props.city || "Explore"}
            </h1>
          </Show>

          <Show
            when={!props.loading}
            fallback={<div class="h-20 w-full bg-muted rounded animate-pulse" />}
          >
            <p class="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              {props.description || "Discover amazing places and create unforgettable memories."}
            </p>
          </Show>

          <Show when={props.weather}>
            <div class="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <span class="font-medium">Weather:</span> {props.weather}
            </div>
          </Show>

          <Show when={props.onPlanTrip}>
            <div class="mt-6">
              <button
                onClick={props.onPlanTrip}
                class="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-blue-600/20 transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
              >
                Plan New Trip
                <ArrowRight class="h-4 w-4" />
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
