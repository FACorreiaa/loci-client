// Where the traveller is standing: today's weather, alerts, and three short
// headline lists. Only for a real position; absent when there is nothing to say.
import { For, Show, createMemo } from "solid-js";
import { TriangleAlert } from "lucide-solid";
import { useUserLocation } from "~/contexts/LocationContext";
import { hasAnything, placeLabel, useHereBrief, type HereBriefData } from "~/lib/api/hereBrief";
import { conditionIcon, dayLabel } from "~/components/LocalWeather";
import { colorForSeverity } from "~/lib/theme-colors";
import { timeAgo, type NewsTickerItem } from "~/lib/news/ticker";

const VISIBLE = 3;

function HeadlineList(props: { title: string; items: NewsTickerItem[] }) {
  const now = () => new Date();
  return (
    <Show when={props.items.length > 0}>
      <div class="min-w-0">
        <p class="kicker mb-2">{props.title}</p>
        <ul class="space-y-2">
          <For each={props.items.slice(0, VISIBLE)}>
            {(item) => (
              <li>
                <a href={item.url} target="_blank" rel="noopener" class="group block">
                  <span class="line-clamp-2 text-sm text-foreground group-hover:underline">
                    {item.title}
                  </span>
                  <span class="text-[11px] text-muted-foreground">
                    {item.source} · {timeAgo(item.publishedAt, now())}
                  </span>
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}

function Today(props: { data: HereBriefData }) {
  const today = () => props.data.weather[0];
  return (
    <div class="min-w-0">
      <Show when={today()}>
        {(t) => {
          const Icon = conditionIcon(t().condition);
          return (
            <div class="mb-3 flex items-center gap-3">
              <Icon class="h-8 w-8 text-primary" aria-hidden="true" />
              <div>
                <p class="text-2xl tabular-nums">
                  {Math.round(t().highC)}°{" "}
                  <span class="text-base text-muted-foreground">/ {Math.round(t().lowC)}°</span>
                </p>
                <p class="text-xs text-muted-foreground">
                  {t().condition}
                  <Show when={props.data.estimated}> · estimated</Show>
                </p>
              </div>
            </div>
          );
        }}
      </Show>
      <Show when={props.data.weather.length > 1}>
        <div class="mb-3 flex gap-3 text-xs text-muted-foreground">
          <For each={props.data.weather.slice(1)}>
            {(w) => (
              <span class="tabular-nums">
                {dayLabel(w.date)} {Math.round(w.highC)}°/{Math.round(w.lowC)}°
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.data.alerts.length > 0}>
        <ul class="space-y-1">
          <For each={props.data.alerts.slice(0, 3)}>
            {(a) => (
              <li class="flex items-start gap-1.5 text-xs">
                <TriangleAlert
                  class="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: colorForSeverity(a.severity) }}
                  aria-hidden="true"
                />
                <span class="text-foreground">{a.title}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

export default function HereNowBand() {
  const { userLocation } = useUserLocation();
  const query = useHereBrief(
    () => userLocation()?.latitude,
    () => userLocation()?.longitude,
  );
  const data = createMemo(() => (query.data && hasAnything(query.data) ? query.data : undefined));

  return (
    <Show when={data()}>
      {(d) => (
        <section class="loci-card mb-8 rounded-2xl p-5 sm:p-6" aria-label="Here now">
          <div class="mb-4 flex items-baseline justify-between gap-4">
            <p class="kicker">Here now{placeLabel(d()) ? ` · ${placeLabel(d())}` : ""}</p>
            <Show when={d().stale}>
              <span class="text-[11px] text-muted-foreground">some sources delayed</span>
            </Show>
          </div>
          <div class="grid gap-6 md:grid-cols-[minmax(0,14rem)_repeat(3,minmax(0,1fr))]">
            <Today data={d()} />
            <HeadlineList title="Around you" items={d().local} />
            <HeadlineList title="Getting around" items={d().disruption} />
            <HeadlineList title="What's on" items={d().whatsOn} />
          </div>
        </section>
      )}
    </Show>
  );
}
