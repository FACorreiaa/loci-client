import { For } from "solid-js";
import RouteStop from "./RouteStop";

const steps = [
  {
    n: "01 · describe",
    title: "Say what you want",
    body: "A city and a feeling is enough. “Two slow days in Porto, wine and old streets.”",
  },
  {
    n: "02 · plot",
    title: "Loci plots the places",
    body: "Real places, matched to your taste and time, ordered into a walkable route on a live map.",
  },
  {
    n: "03 · go",
    title: "Reshape and go",
    body: "Swap a stop, stretch a day, save it. It’s your plan — Loci just drew the first draft.",
  },
];

export default function HowItWorks() {
  return (
    <RouteStop id="how">
      <div class="flex items-baseline gap-3.5">
        <span class="font-coord text-xs uppercase tracking-[0.18em] text-primary">stop 01</span>
        <span class="font-coord text-xs text-muted-foreground">describe → plot → go</span>
      </div>
      <h2 class="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
        Three steps from idea to itinerary.
      </h2>
      <p class="mt-3 max-w-[58ch] text-muted-foreground">
        No endless tabs, no generic top-ten lists. You describe the trip once; Loci does the
        plotting.
      </p>
      <div class="mt-8 grid gap-4 sm:grid-cols-3">
        <For each={steps}>
          {(s) => (
            <div class="rounded-2xl border border-border bg-card p-5">
              <div class="font-coord text-xs tracking-wide text-primary">{s.n}</div>
              <h3 class="mt-3 text-lg font-semibold">{s.title}</h3>
              <p class="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          )}
        </For>
      </div>
    </RouteStop>
  );
}
