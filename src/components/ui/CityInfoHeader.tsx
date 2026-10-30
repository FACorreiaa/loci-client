import { Component, Show } from "solid-js";
import { Users, Ruler, Languages, CloudSun } from "lucide-solid";

interface CityData {
  city?: string;
  country?: string;
  description?: string;
  population?: string;
  area?: string;
  language?: string;
  weather?: string;
  [key: string]: any;
}

interface CityInfoHeaderProps {
  cityData?: CityData;
  isLoading?: boolean;
  /** Overrides cityData.description — the typed-out copy while streaming. */
  description?: string;
}

export const CityInfoHeader: Component<CityInfoHeaderProps> = (props) => {
  return (
    <Show when={props.cityData || props.isLoading}>
      <div class="relative overflow-hidden rounded-2xl p-6 md:p-8 mb-6 text-hero-foreground shadow-xl transition-all hover:shadow-2xl group">
        {/* Animated Background - Glassy Gradient */}
        {/* Was a hardcoded blue→purple→indigo gradient under a heavy blur, which
            ignored the theme entirely and did not match any other surface. The
            hero gradient is token-driven, so it follows light/dark and the Loci
            palette. */}
        <div class="loci-hero absolute inset-0 z-0 rounded-none border-0 shadow-none" />

        {/* Accents/Noise for texture */}
        <div class="absolute inset-0 domain-noise opacity-40 z-0" />

        <div class="relative z-10">
          <Show
            when={!props.isLoading}
            fallback={<div class="animate-pulse h-32 bg-hero-foreground/15 rounded-xl" />}
          >
            <div class="space-y-4">
              <div>
                <h1 class="text-3xl md:text-5xl font-bold tracking-tight mb-2 text-hero-foreground drop-shadow-sm">
                  {props.cityData?.city}
                  <span class="text-hero-foreground/70 text-2xl md:text-4xl font-medium ml-2 opacity-80">
                    , {props.cityData?.country}
                  </span>
                </h1>
                <p class="text-hero-foreground/90 text-sm md:text-base leading-relaxed max-w-3xl font-medium">
                  {props.description ?? props.cityData?.description}
                </p>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="bg-hero-foreground/10 backdrop-blur-md rounded-xl p-3 border border-hero-foreground/10 flex flex-col items-center justify-center text-center hover:bg-hero-foreground/15 transition-colors">
                  <Users class="w-5 h-5 mb-1 text-hero-foreground/70" />
                  <span class="text-xs text-hero-foreground/80 uppercase font-semibold tracking-wider">
                    Pop
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.population || "N/A"}
                  </span>
                </div>
                <div class="bg-hero-foreground/10 backdrop-blur-md rounded-xl p-3 border border-hero-foreground/10 flex flex-col items-center justify-center text-center hover:bg-hero-foreground/15 transition-colors">
                  <Ruler class="w-5 h-5 mb-1 text-hero-foreground/70" />
                  <span class="text-xs text-hero-foreground/80 uppercase font-semibold tracking-wider">
                    Area
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.area || "N/A"}
                  </span>
                </div>
                <div class="bg-hero-foreground/10 backdrop-blur-md rounded-xl p-3 border border-hero-foreground/10 flex flex-col items-center justify-center text-center hover:bg-hero-foreground/15 transition-colors">
                  <Languages class="w-5 h-5 mb-1 text-hero-foreground/70" />
                  <span class="text-xs text-hero-foreground/80 uppercase font-semibold tracking-wider">
                    Lang
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.language || "N/A"}
                  </span>
                </div>
                <div class="bg-hero-foreground/10 backdrop-blur-md rounded-xl p-3 border border-hero-foreground/10 flex flex-col items-center justify-center text-center hover:bg-hero-foreground/15 transition-colors">
                  <CloudSun class="w-5 h-5 mb-1 text-hero-foreground/70" />
                  <span class="text-xs text-hero-foreground/80 uppercase font-semibold tracking-wider">
                    Weather
                  </span>
                  <span class="font-bold text-[10px] md:text-xs leading-tight line-clamp-2">
                    {props.cityData?.weather || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
