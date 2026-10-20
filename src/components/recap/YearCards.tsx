import { For, Show } from "solid-js";
import type { RecapCard } from "~/lib/api/recap";
import {
  countLabel,
  monthName,
  monthShort,
  percentileMetricLabel,
  projectPins,
} from "~/lib/recap/recap";

// The year-in-review cards. Same desk as the trip cards, bigger drawer: a
// wall map, a calendar strip, a postcard of the year's city, a ledger, a
// seal. They mirror the server-drawn share images (render/cards_year.go).

type Card<C extends string> = Extract<RecapCard["card"], { case: C }>["value"];

const MAP_W = 100;
const MAP_H = 62;

export function YearMap(props: { card: Card<"yearMap"> }) {
  const pins = () => projectPins(props.card.cities, MAP_W, MAP_H, 9);
  return (
    <div class="rc-card rc-yearmap">
      <div class="rc-yhead">
        <div class="rc-count rc-ycount">
          {props.card.countriesCount}
          <small>{props.card.countriesCount === 1 ? "country" : "countries"}</small>
        </div>
        <div class="rc-kicker" style={{ color: "var(--rc-muted)" }}>
          {countLabel(props.card.citiesCount, "city", "cities")}
        </div>
      </div>
      <div class="rc-ymap" aria-hidden="true">
        <For each={pins()}>
          {(p, j) => (
            <div
              class="rc-ypin"
              data-side={p.x > MAP_W * 0.62 ? "left" : undefined}
              style={{ left: `${p.x}%`, top: `${(p.y / MAP_H) * 100}%`, "--i": j() }}
            >
              <Show when={j() < 8}>
                <span>{props.card.cities[p.i]?.label}</span>
              </Show>
            </div>
          )}
        </For>
      </div>
      <ul class="rc-ledger">
        <For each={props.card.countries.slice(0, 5)}>
          {(c, i) => (
            <li style={{ "--i": i() }}>
              <b>{c.country || c.countryCode || "—"}</b>
              <Show when={c.firstTime}>
                <em>New</em>
              </Show>
              <span>
                {countLabel(c.citiesCount, "city", "cities")} · {countLabel(c.days, "day", "days")}
              </span>
            </li>
          )}
        </For>
      </ul>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}

export function TripsTimeline(props: { card: Card<"tripsTimeline"> }) {
  const months = () => {
    const byMonth = new Map(props.card.months.map((m) => [m.month, m]));
    return Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1)?.days ?? 0);
  };
  const most = () => Math.max(1, ...months());
  return (
    <div class="rc-card rc-timeline">
      <div class="rc-yhead">
        <div class="rc-count rc-ycount">
          {props.card.tripsCount}
          <small>{props.card.tripsCount === 1 ? "trip" : "trips"}</small>
        </div>
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          {countLabel(props.card.daysAway, "day away", "days away")}
        </div>
      </div>
      <div class="rc-strip" role="img" aria-label="Days away by month">
        <For each={months()}>
          {(days, i) => (
            <div class="rc-month" data-busy={i() + 1 === props.card.busiestMonth ? "" : undefined}>
              <div class="rc-col">
                <Show when={days > 0}>
                  <i style={{ height: `${Math.max(6, (days / most()) * 100)}%`, "--i": i() }} />
                </Show>
              </div>
              <span>{monthShort(i() + 1).slice(0, 1)}</span>
            </div>
          )}
        </For>
      </div>
      <div class="rc-tickets">
        <For each={props.card.trips}>
          {(t, i) => (
            <span style={{ "--i": i() }} title={monthName(t.month)}>
              {t.cityName || "Trip"}
            </span>
          )}
        </For>
      </div>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}

export function TopCity(props: { card: Card<"topCity"> }) {
  const stats = () => [
    { v: props.card.days, one: "Day", many: "Days" },
    { v: props.card.placesCount, one: "Place", many: "Places" },
    { v: props.card.tripsCount, one: "Trip", many: "Trips" },
  ];
  return (
    <div class="rc-card rc-topcity">
      <div class="rc-kicker rc-ykick">Your city this year</div>
      <div class="rc-ypost">
        <div class="rc-yface">
          <b>{props.card.cityName || "Your city"}</b>
        </div>
        <div class="rc-ygreet">
          <span>Greetings from</span>
          <span>{props.card.country || props.card.countryCode}</span>
        </div>
      </div>
      <div class="rc-stats">
        <For each={stats()}>
          {(s) => (
            <div>
              <b>{Math.max(0, s.v).toLocaleString("en-GB")}</b>
              <span>{s.v === 1 ? s.one : s.many}</span>
            </div>
          )}
        </For>
      </div>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}

const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v || 0)) * 100)}%`;

export function TasteShift(props: { card: Card<"tasteShift"> }) {
  return (
    <div class="rc-card rc-shift">
      <div class="rc-kicker rc-ykick">Your taste, January to now</div>
      <div class="rc-shift-body">
        <h3>{props.card.trait?.label || "Something new"}</h3>
        <div class="rc-bars2">
          <div>
            <span>January</span>
            <div class="rc-track">
              <i style={{ "--w": pct(props.card.strengthStart), "--i": 0 }} />
            </div>
          </div>
          <div data-now>
            <span>Now</span>
            <div class="rc-track">
              <i style={{ "--w": pct(props.card.strengthEnd), "--i": 1 }} />
            </div>
          </div>
        </div>
        <Show when={props.card.runnersUp.length > 0}>
          <div class="rc-kicker" style={{ color: "var(--rc-muted)" }}>
            Also on the rise
          </div>
          <ul class="rc-rise">
            <For each={props.card.runnersUp}>{(t) => <li>{t.label}</li>}</For>
          </ul>
        </Show>
      </div>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}

export function Streak(props: { card: Card<"streak"> }) {
  const beads = () => Math.min(35, Math.max(0, props.card.longestStreakDays));
  return (
    <div class="rc-card rc-streak">
      <div class="rc-yhead">
        <div class="rc-big">{props.card.longestStreakDays}</div>
        <div class="rc-italic">days in a row</div>
      </div>
      <div class="rc-beads" aria-hidden="true">
        <For each={Array.from({ length: beads() })}>{(_, i) => <i style={{ "--i": i() }} />}</For>
      </div>
      <Show when={props.card.longestStreakDays > beads()}>
        <div class="rc-kicker" style={{ opacity: 0.7, "margin-top": "2cqw" }}>
          +{props.card.longestStreakDays - beads()} more
        </div>
      </Show>
      <p class="rc-headline rc-streak-line">{props.card.headline}</p>
      <div class="rc-stats" data-dark>
        <div>
          <b>{Math.max(0, props.card.activeDays).toLocaleString("en-GB")}</b>
          <span>{props.card.activeDays === 1 ? "Active day" : "Active days"}</span>
        </div>
        <Show when={monthShort(props.card.bestMonth)}>
          <div>
            <b>{monthShort(props.card.bestMonth)}</b>
            <span>Best month</span>
          </div>
        </Show>
      </div>
    </div>
  );
}

export function Contributions(props: { card: Card<"contributions"> }) {
  const tiles = () => [
    { v: props.card.reviewsCount, one: "Review", many: "Reviews" },
    { v: props.card.listsCount, one: "List", many: "Lists" },
    { v: props.card.postsCount, one: "Post", many: "Posts" },
    { v: props.card.submissionsCount, one: "Place added", many: "Places added" },
  ];
  const total = () => tiles().reduce((s, t) => s + Math.max(0, t.v), 0);
  return (
    <div class="rc-card rc-given">
      <div class="rc-kicker rc-ykick">Given back</div>
      <div class="rc-yhead" style={{ top: "17%" }}>
        <div class="rc-big">{total().toLocaleString("en-GB")}</div>
        <div class="rc-italic" style={{ color: "var(--rc-coral-deep)" }}>
          for other travellers
        </div>
      </div>
      <div class="rc-tiles">
        <For each={tiles()}>
          {(t, i) => (
            <div data-zero={t.v <= 0 ? "" : undefined} style={{ "--i": i() }}>
              <b>{Math.max(0, t.v).toLocaleString("en-GB")}</b>
              <span>{t.v === 1 ? t.one : t.many}</span>
            </div>
          )}
        </For>
      </div>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}

/** A scalloped seal edge: `n` bumps around a circle, in a 100×100 box. */
const SCALLOP = (() => {
  const n = 36;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const r = i % 2 === 0 ? 50 : 46;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

export function Percentile(props: { card: Card<"percentile"> }) {
  return (
    <div class="rc-card rc-pct">
      <div class="rc-kicker rc-ykick">Of every Loci traveller this year</div>
      <div class="rc-pseal">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <polygon points={SCALLOP} fill="var(--rc-coral-deep)" />
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke="var(--rc-paper)"
            stroke-opacity="0.6"
            stroke-width="0.6"
            stroke-dasharray="1.6 1.6"
          />
        </svg>
        <div>
          <span>Top</span>
          <b>{Math.max(1, props.card.topPercent)}%</b>
          <span>{percentileMetricLabel(props.card.metric)}</span>
        </div>
      </div>
      <Show when={props.card.value > 0}>
        <div class="rc-kicker rc-pvalue">
          {countLabel(props.card.value, "place", "places")} this year
        </div>
      </Show>
      <p class="rc-headline rc-yfoot">{props.card.headline}</p>
    </div>
  );
}
