import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import type { Recap, RecapCard } from "~/lib/api/recap";
import { evidenceLine, formatKm, initials, routeBasisCaption, trendLabel } from "~/lib/recap/recap";

/**
 * A number that counts up when the card appears. The server render and the
 * first paint show the final value, so the card reads correctly at rest.
 */
function CountUp(props: { value: number }) {
  const [shown, setShown] = createSignal(props.value);
  onMount(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const target = props.value;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    onCleanup(() => cancelAnimationFrame(raf));
  });
  return <>{shown().toLocaleString("en-GB")}</>;
}

const STAMPS: { shape: string; r: number; left: number; top: number; c?: string }[] = [
  { shape: "round", r: -12, left: 7, top: 45 },
  { shape: "rect", r: 7, left: 50, top: 42, c: "var(--rc-ink)" },
  { shape: "oval", r: -4, left: 38, top: 60 },
  { shape: "rect", r: -9, left: 6, top: 70, c: "var(--rc-teal)" },
  { shape: "round", r: 14, left: 60, top: 73, c: "var(--rc-ink)" },
  { shape: "oval", r: 6, left: 8, top: 57, c: "var(--rc-teal)" },
];

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

function Intro(props: {
  recap: Recap;
  card: Extract<RecapCard["card"], { case: "intro" }>["value"];
}) {
  return (
    <div class="rc-card rc-intro">
      <p class="rc-lede">{props.card.lede}</p>
      <div class="rc-tagrig">
        <div class="rc-string" />
        <div class="rc-tag">
          <div class="rc-code">{props.card.shortCode || "···"}</div>
          <div class="rc-city">{props.card.primaryCity || props.recap.title}</div>
          <Show when={props.card.country}>
            <div class="rc-kicker" style={{ "margin-top": "1%", color: "var(--rc-muted)" }}>
              {props.card.country}
            </div>
          </Show>
          <div class="rc-rows">
            <div>
              <span>Days</span>
              <strong>{props.card.dayCount}</strong>
            </div>
            <div>
              <span>When</span>
              <strong>{props.recap.periodLabel}</strong>
            </div>
          </div>
          <div class="rc-barcode" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function Places(props: { card: Extract<RecapCard["card"], { case: "places" }>["value"] }) {
  const byStops = () => props.card.placesCount === 0;
  return (
    <div class="rc-card rc-places">
      <div class="rc-head">
        <div class="rc-count">
          <CountUp value={byStops() ? props.card.stopsDone : props.card.placesCount} />
          <small>{byStops() ? `of ${props.card.stopsPlanned} stops` : "places"}</small>
        </div>
        <p class="rc-headline">{props.card.headline}</p>
      </div>
      <For each={props.card.groups.slice(0, STAMPS.length)}>
        {(g, i) => {
          const s = STAMPS[i()];
          return (
            <div
              class="rc-stamp"
              data-shape={s.shape}
              style={{
                "--i": i(),
                "--r": `${s.r}deg`,
                left: `${s.left}%`,
                top: `${s.top}%`,
                ...(s.c ? { "--c": s.c } : {}),
              }}
            >
              <div>
                <b>{g.label}</b>
                <span>
                  {g.firstDate
                    ? shortDate(g.firstDate)
                    : `${g.placesCount} place${g.placesCount === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

/** Projects lat/lon into a 100x60 box (equirectangular, cos-lat corrected). */
const project = (pts: { latitude: number; longitude: number }[]) => {
  if (pts.length < 2) return [];
  const midLat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
  const k = Math.cos((midLat * Math.PI) / 180) || 1;
  const xs = pts.map((p) => p.longitude * k);
  const ys = pts.map((p) => -p.latitude);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const span = Math.max(maxX - minX, (maxY - minY) * (100 / 60), 1e-6);
  const sx = 88 / span;
  const ox = 6 + (88 - (maxX - minX) * sx) / 2;
  const oy = 6 + (48 - (maxY - minY) * sx) / 2;
  return xs.map((x, i) => [ox + (x - minX) * sx, oy + (ys[i] - minY) * sx] as const);
};

function Route(props: { card: Extract<RecapCard["card"], { case: "route" }>["value"] }) {
  const pts = () => project(props.card.points);
  const first = () => props.card.points[0]?.label;
  const last = () => props.card.points[props.card.points.length - 1]?.label;
  return (
    <div class="rc-card rc-route">
      <div class="rc-pass">
        <div class="rc-pass-head rc-kicker">
          <span>Boarding pass</span>
          <span>Loci</span>
        </div>
        <div class="rc-pass-body">
          <Show when={first() && last()}>
            <div class="rc-legs">
              <span>{first()}</span>
              <span aria-hidden="true">→</span>
              <span>{last()}</span>
            </div>
          </Show>
          <div class="rc-km">{formatKm(props.card.distanceKm)}</div>
          <div class="rc-kicker" style={{ color: "var(--rc-muted)" }}>
            {routeBasisCaption(props.card.basis)}
          </div>
          <Show when={pts().length >= 2}>
            <div class="rc-sketch" aria-hidden="true">
              <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                <path
                  d={pts()
                    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
                    .join(" ")}
                  pathLength="1"
                  fill="none"
                  stroke="var(--rc-coral)"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <For each={pts()}>
                  {([x, y], i) => (
                    <circle
                      cx={x}
                      cy={y}
                      r={i() === 0 || i() === pts().length - 1 ? 2 : 1.1}
                      fill={
                        i() === 0 || i() === pts().length - 1
                          ? "var(--rc-coral-deep)"
                          : "var(--rc-ink)"
                      }
                    />
                  )}
                </For>
              </svg>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

function Days(props: { card: Extract<RecapCard["card"], { case: "days" }>["value"] }) {
  const stubs = () =>
    props.card.days.length > 0
      ? props.card.days
      : Array.from({ length: props.card.daysTotal }, (_, i) => ({
          dayNumber: i + 1,
          completed: i < props.card.daysCompleted,
          stopsDone: 0,
        }));
  return (
    <div class="rc-card rc-days">
      <div class="rc-head">
        <div class="rc-count">
          {props.card.daysCompleted}
          <small>of {props.card.daysTotal} days</small>
        </div>
        <p class="rc-headline" style={{ "margin-top": "3%" }}>
          {props.card.headline}
        </p>
      </div>
      <div class="rc-stubs">
        <For each={stubs().slice(0, 12)}>
          {(d, i) => (
            <div class="rc-stub" data-done={d.completed ? "" : undefined} style={{ "--i": i() }}>
              Day
              <b>{d.dayNumber}</b>
              {d.stopsDone ? `${d.stopsDone} stops` : d.completed ? "walked" : " "}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function Taste(props: {
  card: Extract<RecapCard["card"], { case: "taste" }>["value"];
  city?: string;
}) {
  return (
    <div class="rc-card rc-taste">
      <div class="rc-kicker">
        {props.card.fromPeriod ? "On this trip, Loci noticed" : "Your taste, so far"}
      </div>
      <div class="rc-postcard">
        <div class="rc-pstamp" aria-hidden="true">
          {(props.city ?? "").slice(0, 2).toUpperCase() || "✶"}
        </div>
        <h3>{props.card.headline}</h3>
        <ul class="rc-traits">
          <For each={props.card.traits}>
            {(t, i) => (
              <li style={{ "--i": i() }}>
                <span class="rc-trait">{t.label}</span>
                <div
                  class="rc-line"
                  style={{
                    "--w": `${Math.round(Math.max(0.1, Math.min(1, t.strength)) * 100)}%`,
                    "--i": i(),
                  }}
                >
                  <i />
                </div>
                <div class="rc-meta">
                  <span>{evidenceLine(t.evidenceCount, t.evidenceKind)}</span>
                  <span>{trendLabel(t.trend)}</span>
                </div>
              </li>
            )}
          </For>
        </ul>
        <p class="rc-sign">Your taste, as Loci sees it</p>
      </div>
    </div>
  );
}

const REASON = ["", "Kept", "Reviewed", "First visit"];

function Highlights(props: { card: Extract<RecapCard["card"], { case: "highlights" }>["value"] }) {
  return (
    <div class="rc-card rc-highlights">
      <div class="rc-center" style={{ top: "11%" }}>
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          {props.card.headline}
        </div>
      </div>
      <div class="rc-pins">
        <For each={props.card.highlights}>
          {(h, i) => (
            <div class="rc-pin" style={{ "--i": i(), "--r": `${[-2, 1.5, -1][i() % 3]}deg` }}>
              <b>{h.name}</b>
              <span>
                {[h.category, REASON[h.reason] ?? ""].filter(Boolean).join(" · ")}
                <Show when={h.rating > 0}>
                  {" · "}
                  <span class="rc-stars" aria-label={`${h.rating} out of 5`}>
                    {"★".repeat(h.rating)}
                  </span>
                </Show>
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function Progress(props: { card: Extract<RecapCard["card"], { case: "progress" }>["value"] }) {
  return (
    <div class="rc-card rc-progress">
      <div class="rc-center">
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          Points on this trip
        </div>
        <div class="rc-big">
          <CountUp value={Number(props.card.points)} />
        </div>
        <p class="rc-headline">{props.card.headline}</p>
        <Show when={props.card.badges.length > 0}>
          <div class="rc-seals">
            <For each={props.card.badges}>
              {(b, i) => (
                <div class="rc-seal" style={{ "--i": i(), color: "var(--rc-coral)" }}>
                  {b.label}
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.card.streakDays > 1}>
          <div class="rc-kicker">{props.card.streakDays}-day streak along the way</div>
        </Show>
      </div>
    </div>
  );
}

function Field(props: { card: Extract<RecapCard["card"], { case: "field" }>["value"] }) {
  return (
    <div class="rc-card rc-field">
      <div class="rc-center">
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          Your field rank in {props.card.cityName}
        </div>
        <div class="rc-seal" style={{ "--i": 0 }}>
          <div>
            <b>{props.card.rankLabel}</b>
            {Number(props.card.score).toLocaleString("en-GB")} field points
          </div>
        </div>
        <p class="rc-headline">{props.card.headline}</p>
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          {props.card.placesKept} places kept · {props.card.daysFinished} days finished
        </div>
      </div>
    </div>
  );
}

function Friends(props: {
  card: Extract<RecapCard["card"], { case: "friends" }>["value"];
  city?: string;
}) {
  return (
    <div class="rc-card rc-friends">
      <div class="rc-center">
        <div class="rc-big">{props.card.friendsBeenCount}</div>
        <p class="rc-headline">
          {props.card.headline ||
            `of your friends have ${props.city ?? "this city"} on a trip too.`}
        </p>
        <div class="rc-faces">
          <For each={props.card.friends}>
            {(f, i) => (
              <div class="rc-face" style={{ "--i": i() }} title={f.displayName}>
                <Show when={f.avatarUrl} fallback={initials(f.displayName)}>
                  <img src={f.avatarUrl} alt={f.displayName} loading="lazy" />
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function Outro(props: {
  recap: Recap;
  card: Extract<RecapCard["card"], { case: "outro" }>["value"];
  footer?: JSX.Element;
}) {
  return (
    <div class="rc-card rc-outro">
      <div class="rc-center" style={{ top: "26%" }}>
        <div class="rc-kicker" style={{ opacity: 0.7 }}>
          {props.recap.title} · {props.recap.periodLabel}
        </div>
        <h2>{props.card.headline}</h2>
        <Show when={props.card.summaryLine}>
          <div class="rc-summary">{props.card.summaryLine}</div>
        </Show>
        {props.footer}
      </div>
    </div>
  );
}

/**
 * Draws one card. Unknown cards draw nothing (the player never selects them).
 * The player mounts a fresh view per card, so this switch runs once per card.
 */
export function RecapCardView(props: { recap: Recap; card: RecapCard; outroFooter?: JSX.Element }) {
  const city = () => {
    const intro = props.recap.cards.find((c) => c.card.case === "intro");
    return intro?.card.case === "intro" ? intro.card.value.primaryCity : undefined;
  };
  const body = (): JSX.Element => {
    const c = props.card.card;
    switch (c.case) {
      case "intro":
        return <Intro recap={props.recap} card={c.value} />;
      case "places":
        return <Places card={c.value} />;
      case "route":
        return <Route card={c.value} />;
      case "days":
        return <Days card={c.value} />;
      case "taste":
        return <Taste card={c.value} city={city()} />;
      case "highlights":
        return <Highlights card={c.value} />;
      case "progress":
        return <Progress card={c.value} />;
      case "field":
        return <Field card={c.value} />;
      case "friends":
        return <Friends card={c.value} city={city()} />;
      case "outro":
        return <Outro recap={props.recap} card={c.value} footer={props.outroFooter} />;
      default:
        return null;
    }
  };
  return <>{body()}</>;
}
