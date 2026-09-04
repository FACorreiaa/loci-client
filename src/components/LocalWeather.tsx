import { For, Show } from "solid-js";
import {
  CloudSun,
  TriangleAlert,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  Snowflake,
  Thermometer,
} from "lucide-solid";
import type { Component } from "solid-js";
import { useLocalContext } from "~/lib/api/localContext";
import { colorForSeverity } from "~/lib/theme-colors";

const conditionIcon = (c: string): Component<{ class?: string }> => {
  const k = c.toLowerCase();
  if (k.includes("clear")) return Sun;
  if (k.includes("cloud")) return Cloud;
  if (k.includes("rain") || k.includes("drizzle")) return CloudRain;
  if (k.includes("snow")) return Snowflake;
  if (k.includes("thunder")) return CloudLightning;
  if (k.includes("mist") || k.includes("fog") || k.includes("haze")) return CloudFog;
  return Thermometer;
};

const dayLabel = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short" }) : "";

/** Compact local-context nudge: a few days of weather + any alerts. */
export default function LocalWeather(props: {
  latitude?: number;
  longitude?: number;
  days?: number;
}) {
  const ctx = useLocalContext(
    () => props.latitude,
    () => props.longitude,
    () => props.days ?? 5,
  );

  return (
    <Show when={ctx.data?.weather.length ? ctx.data : undefined}>
      {(data) => (
        <div class="loci-card rounded-xl p-3">
          <div class="mb-2 flex items-center gap-2 text-sm font-medium">
            <CloudSun class="h-4 w-4 text-primary" />
            Weather
            <Show when={data().estimated}>
              <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                estimated
              </span>
            </Show>
          </div>

          <div class="flex flex-wrap gap-3">
            <For each={data().weather}>
              {(w) => {
                const Icon = conditionIcon(w.condition);
                return (
                  <div class="flex min-w-14 flex-col items-center rounded-md bg-secondary/40 px-2 py-1.5 text-center">
                    <span class="text-[11px] text-muted-foreground">{dayLabel(w.date)}</span>
                    <Icon class="h-5 w-5 text-primary" aria-hidden="true" />
                    <span class="mt-1 text-xs tabular-nums">
                      {Math.round(w.highC)}° / {Math.round(w.lowC)}°
                    </span>
                    <Show when={w.precipProb >= 0.3}>
                      <span class="text-[10px] text-sky-600">
                        {Math.round(w.precipProb * 100)}%
                      </span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Alerts arrive most-severe first from the server, so the list needs
              no sorting — only the colour that makes the ranking visible. */}
          <Show when={data().alerts.length > 0}>
            <ul class="mt-3 space-y-1.5">
              <For each={data().alerts}>
                {(a) => (
                  <li class="flex items-start gap-1.5 text-xs">
                    <TriangleAlert
                      class="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: colorForSeverity(a.severity) }}
                      aria-hidden="true"
                    />
                    <span class="text-muted-foreground">
                      <span class="font-medium text-foreground">{a.title}</span>
                      <Show when={a.detail}> — {a.detail}</Show>
                      {/* Naming the provider matters: these range from a measured
                          earthquake to an unverified headline, and the user should
                          be able to weigh them differently. */}
                      <Show when={a.source}>
                        <span class="ml-1 text-[0.65rem] uppercase tracking-wide opacity-60">
                          {a.source}
                        </span>
                      </Show>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      )}
    </Show>
  );
}
