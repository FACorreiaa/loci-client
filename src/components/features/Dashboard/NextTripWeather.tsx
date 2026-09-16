// Three days of forecast for the next trip's city. Text only, and nothing at
// all when the server could only estimate: a guessed forecast is a fake metric.
import { For, Show } from "solid-js";
import { useLocalContext } from "~/lib/api/localContext";

interface Props {
  lat?: number;
  lon?: number;
}

const weekday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short" });

export default function NextTripWeather(props: Props) {
  // Default span so the query key matches the itinerary page and the cache is shared.
  const ctx = useLocalContext(
    () => props.lat,
    () => props.lon,
  );
  const days = () => {
    const data = ctx.data;
    if (!data || data.estimated || data.weather.length === 0) return undefined;
    return data.weather.slice(0, 3);
  };

  return (
    <Show when={days()}>
      {(list) => (
        <ul class="flex gap-6" aria-label="Forecast">
          <For each={list()}>
            {(w) => (
              <li class="min-w-0">
                <p class="font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {weekday(w.date)}
                </p>
                <p class="mt-1 text-sm tabular-nums text-foreground">
                  {Math.round(w.highC)}° / {Math.round(w.lowC)}°
                </p>
                <p class="mt-0.5 truncate text-xs lowercase text-muted-foreground">{w.condition}</p>
              </li>
            )}
          </For>
        </ul>
      )}
    </Show>
  );
}
