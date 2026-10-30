import { Component, For, Show } from "solid-js";
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

// Everything on the hero is drawn in `--hero-foreground` so it follows the
// token in both appearances. The previous `text-blue-*` labels were the only
// blue in the product and measured as grey-on-colour.
const heroInk = "text-hero-foreground";
const heroInkSoft = "text-hero-foreground/80";

export const CityInfoHeader: Component<CityInfoHeaderProps> = (props) => {
  const stats = () =>
    [
      { label: "Pop", value: props.cityData?.population, Icon: Users },
      { label: "Area", value: props.cityData?.area, Icon: Ruler },
      { label: "Lang", value: props.cityData?.language, Icon: Languages },
      { label: "Weather", value: props.cityData?.weather, Icon: CloudSun },
    ].filter((s) => Boolean(s.value));

  return (
    <Show when={props.cityData || props.isLoading}>
      <div class={`relative mb-6 overflow-hidden rounded-2xl p-6 md:p-8 ${heroInk}`}>
        {/* Token-driven hero ground: follows light/dark and the Loci palette. */}
        <div class="loci-hero absolute inset-0 z-0 rounded-none border-0 shadow-none" />
        <div class="domain-noise absolute inset-0 z-0 opacity-40" aria-hidden="true" />

        <div class="relative z-10">
          <Show
            when={!props.isLoading}
            fallback={
              <div class="h-32 animate-pulse rounded-xl bg-hero-foreground/15" aria-hidden="true" />
            }
          >
            <div class="space-y-4">
              <div>
                <h1 class="mb-2 font-display text-3xl font-semibold tracking-tight md:text-5xl">
                  {props.cityData?.city}
                  <Show when={props.cityData?.country}>
                    <span class={`ml-2 text-2xl font-medium md:text-4xl ${heroInkSoft}`}>
                      , {props.cityData?.country}
                    </span>
                  </Show>
                </h1>
                <p class={`max-w-3xl text-sm leading-relaxed md:text-base ${heroInkSoft}`}>
                  {props.description ?? props.cityData?.description}
                </p>
              </div>

              {/* Only the facts we have. Four tiles reading "N/A" told the
                  reader nothing and looked like a broken fetch. */}
              <Show when={stats().length > 0}>
                <dl class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <For each={stats()}>
                    {(s) => (
                      <div class="flex flex-col items-center justify-center rounded-xl border border-hero-foreground/15 bg-hero-foreground/10 p-3 text-center">
                        <s.Icon class={`mb-1 h-5 w-5 ${heroInkSoft}`} aria-hidden="true" />
                        <dt
                          class={`font-coord text-[10px] uppercase tracking-[0.12em] ${heroInkSoft}`}
                        >
                          {s.label}
                        </dt>
                        <dd class="text-sm font-semibold leading-tight md:text-base">{s.value}</dd>
                      </div>
                    )}
                  </For>
                </dl>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
