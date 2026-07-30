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
}

export const CityInfoHeader: Component<CityInfoHeaderProps> = (props) => {
  return (
    <Show when={props.cityData || props.isLoading}>
      <div class="relative overflow-hidden rounded-2xl p-6 md:p-8 mb-6 text-white shadow-xl transition-all hover:shadow-2xl group">
        {/* Animated Background - Glassy Gradient */}
        {/* Was a hardcoded blue→purple→indigo gradient under a heavy blur, which
            ignored the theme entirely and did not match any other surface. The
            hero gradient is token-driven, so it follows light/dark and the Loci
            palette. */}
        <div class="loci-hero absolute inset-0 z-0 rounded-none border-0 shadow-none" />

        {/* Accents/Noise for texture */}
        <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay" />
        <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-colors duration-500" />

        <div class="relative z-10">
          <Show
            when={!props.isLoading}
            fallback={<div class="animate-pulse h-32 bg-white/20 rounded-xl" />}
          >
            <div class="space-y-4">
              <div>
                <h1 class="text-3xl md:text-5xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">
                  {props.cityData?.city}
                  <span class="text-blue-200 text-2xl md:text-4xl font-medium ml-2 opacity-80">
                    , {props.cityData?.country}
                  </span>
                </h1>
                <p class="text-blue-50/90 text-sm md:text-base leading-relaxed max-w-3xl font-medium">
                  {props.cityData?.description}
                </p>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                  <Users class="w-5 h-5 mb-1 text-blue-200" />
                  <span class="text-xs text-blue-100 uppercase font-semibold tracking-wider">
                    Pop
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.population || "N/A"}
                  </span>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                  <Ruler class="w-5 h-5 mb-1 text-blue-200" />
                  <span class="text-xs text-blue-100 uppercase font-semibold tracking-wider">
                    Area
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.area || "N/A"}
                  </span>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                  <Languages class="w-5 h-5 mb-1 text-blue-200" />
                  <span class="text-xs text-blue-100 uppercase font-semibold tracking-wider">
                    Lang
                  </span>
                  <span class="font-bold text-sm md:text-base">
                    {props.cityData?.language || "N/A"}
                  </span>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                  <CloudSun class="w-5 h-5 mb-1 text-blue-200" />
                  <span class="text-xs text-blue-100 uppercase font-semibold tracking-wider">
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
