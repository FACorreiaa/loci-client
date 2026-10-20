import { For, Match, Switch } from "solid-js";
import { backRow, frontRow, heroCards, type HeroCard, type HeroCardId } from "./heroCards";

/**
 * The fan of postcards along the bottom of the hero. Decorative only: the
 * whole wall is aria-hidden, holds nothing focusable, and its images are
 * alt="". Layout and motion live in landing.css (`.card-wall`).
 *
 * Front row: 15 cards across 0–100%, ±21°, arched downward so the edges
 * bleed off the bottom. Back row (md+): 14 cards, ±15.6°, scaled .9 and
 * arched upward so it peeks over the front row's shoulders.
 */

type Slot = { id: HeroCardId; x: number; rot: number; y: number; z: number; show: string };

// Front-row indices that are always visible, then the extra ones at md / lg.
const FRONT_ALWAYS = new Set([0, 4, 7, 10, 14]);
const FRONT_MD = new Set([2, 5, 9, 12]);

const round = (n: number) => Math.round(n * 100) / 100;

const frontSlots: Slot[] = frontRow.map((id, i) => {
  const t = (i - 7) / 7;
  return {
    id,
    x: round((i * 100) / 14),
    rot: 21 - 3 * i,
    y: round(20 + 16.8 * t * t),
    z: 100 - Math.abs(i - 7) * 2,
    show: FRONT_ALWAYS.has(i) ? "" : FRONT_MD.has(i) ? "hidden md:block" : "hidden lg:block",
  };
});

const backSlots: Slot[] = backRow.map((id, i) => {
  const t = (i - 6.5) / 6.5;
  return {
    id,
    x: round(3.6 + (i * 92.8) / 13),
    rot: round(15.6 - 2.4 * i),
    y: round(-14.6 + 18.1 * t * t),
    z: 50 - Math.round(Math.abs(i - 6.5)),
    show: "hidden md:block",
  };
});

// Three route shapes for the mini maps, picked per slot so neighbours differ.
const routes = [
  {
    d: "M10 48 C 26 40, 30 22, 48 26 S 70 44, 88 14",
    dots: [
      [10, 48],
      [48, 26],
      [88, 14],
    ],
  },
  {
    d: "M12 18 C 30 30, 40 50, 56 40 S 78 18, 90 44",
    dots: [
      [12, 18],
      [56, 40],
      [90, 44],
    ],
  },
  {
    d: "M8 34 C 22 12, 44 14, 50 32 S 74 52, 92 24",
    dots: [
      [8, 34],
      [50, 32],
      [92, 24],
    ],
  },
];

function MiniMap(props: { variant: number }) {
  const r = () => routes[props.variant % routes.length];
  return (
    <svg viewBox="0 0 100 60" class="wall-map" preserveAspectRatio="none">
      <path d="M-5 50 Q 30 30, 60 44 T 110 30" class="wall-contour" />
      <path d="M-5 30 Q 25 8, 55 22 T 110 8" class="wall-contour" />
      <path d="M-5 62 Q 40 46, 70 58 T 110 50" class="wall-contour" />
      <path d={r().d} class="wall-route" />
      <For each={r().dots}>
        {([cx, cy], i) => <circle cx={cx} cy={cy} r={i() === 2 ? 3.4 : 2.4} class="wall-dot" />}
      </For>
    </svg>
  );
}

function CardBody(props: { card: HeroCard; variant: number }) {
  return (
    <Switch>
      <Match when={props.card.kind === "shot" && props.card}>
        {(c) => (
          // Eager on purpose: on desktop a screenshot card is the largest
          // thing above the fold, so lazy-loading it delays LCP. Each is <10 KB
          // at the 200w size a 1x screen picks.
          <img
            src={c().src}
            srcset={`${c().src.replace(/\.webp$/, "-200.webp")} 200w, ${c().src} 384w`}
            sizes="(min-width: 768px) 12rem, 8rem"
            alt=""
            width="384"
            height="834"
            decoding="async"
            class="h-full w-full object-cover object-top"
          />
        )}
      </Match>
      <Match when={props.card.kind === "place" && props.card}>
        {(c) => (
          <div class="wall-body">
            <div class="flex items-start justify-between">
              <span class="wall-stamp">{c().stamp}</span>
              <span class="wall-mono wall-faint">
                No.{String(props.variant + 3).padStart(2, "0")}
              </span>
            </div>
            <MiniMap variant={props.variant} />
            <div class="mt-auto">
              <p class="wall-name">{c().name}</p>
              <p class="wall-city">{c().city}</p>
              <p class="wall-mono wall-faint mt-[3cqw]">{c().coords}</p>
              <p class="wall-mono wall-leg mt-[3cqw]">
                <span class="wall-leg-line" />
                {c().route}
              </p>
              {c().chip && <span class="wall-chip mt-[4cqw]">{c().chip}</span>}
            </div>
          </div>
        )}
      </Match>
      <Match when={props.card.kind === "plan" && props.card}>
        {(c) => (
          <div class="wall-body">
            <span class="wall-mono wall-kicker">{c().title}</span>
            <ol class="wall-plan">
              <For each={c().stops}>
                {(s) => (
                  <li>
                    <span class="wall-mono wall-faint">{s.time}</span>
                    <span class="wall-plan-name">{s.name}</span>
                  </li>
                )}
              </For>
            </ol>
            {c().chip && <span class="wall-chip mt-auto">{c().chip}</span>}
          </div>
        )}
      </Match>
      <Match when={props.card.kind === "tally" && props.card}>
        {(c) => {
          const max = () => Math.max(...c().rows.map((r) => r.places));
          return (
            <div class="wall-body">
              <span class="wall-mono wall-kicker">{c().title}</span>
              <p class="wall-name mt-[4cqw]">Who explored most</p>
              <ul class="wall-tally">
                <For each={c().rows}>
                  {(r) => (
                    <li>
                      <span class="flex justify-between">
                        <span>{r.who}</span>
                        <span class="wall-mono">{r.places}</span>
                      </span>
                      <span class="wall-bar" style={{ width: `${(r.places / max()) * 100}%` }} />
                    </li>
                  )}
                </For>
              </ul>
              <span class="wall-mono wall-faint mt-auto">places collected</span>
            </div>
          );
        }}
      </Match>
    </Switch>
  );
}

function Row(props: { slots: Slot[]; back?: boolean }) {
  return (
    <For each={props.slots}>
      {(slot, i) => {
        const card = heroCards[slot.id] as HeroCard;
        const tone = card.kind === "shot" ? "shot" : card.tone;
        return (
          <div
            class={`wall-slot ${slot.show}`}
            classList={{ "wall-slot-back": props.back }}
            style={{
              "--x": `${slot.x}%`,
              "--rot": `${slot.rot}deg`,
              "--y": `${slot.y}%`,
              "z-index": slot.z,
              "--delay": `${(i() % 5) * 0.7}s`,
            }}
          >
            <div class="wall-sway">
              <div class={`wall-card wall-tone-${tone}`}>
                <CardBody card={card} variant={i() + (props.back ? 1 : 0)} />
              </div>
            </div>
          </div>
        );
      }}
    </For>
  );
}

export default function HeroCardWall() {
  return (
    <div class="card-wall" aria-hidden="true">
      <Row slots={backSlots} back />
      <Row slots={frontSlots} />
    </div>
  );
}
