import { For } from "solid-js";
import { Utensils, BedDouble, Star, MapPin } from "lucide-solid";
import RouteStop from "./RouteStop";

const cats = [
  {
    icon: Utensils,
    title: "Restaurants",
    body: "By cuisine, price, and how far you’ll walk for it.",
    meta: "near_you · cuisine · price",
  },
  {
    icon: BedDouble,
    title: "Stays",
    body: "Hotels and rooms that fit the neighbourhood you’re circling.",
    meta: "stars · area · vibe",
  },
  {
    icon: Star,
    title: "Sights & activities",
    body: "Landmarks, viewpoints, and the small things guidebooks miss.",
    meta: "outdoor · duration · type",
  },
  {
    icon: MapPin,
    title: "Near me, now",
    body: "Standing somewhere new? Loci plots what’s worth the next hour.",
    meta: "lat · lon · radius",
  },
];

export default function WhatItFinds() {
  return (
    <RouteStop id="find">
      <div class="flex items-baseline gap-3.5">
        <span class="font-coord text-xs uppercase tracking-[0.18em] text-primary">stop 02</span>
        <span class="font-coord text-xs text-muted-foreground">everything on one map</span>
      </div>
      <h2 class="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
        Every kind of place, in one route.
      </h2>
      <p class="mt-3 max-w-[58ch] text-muted-foreground">
        Loci pulls from a geospatial database of real places — then fills the gaps with AI when a
        corner of the map is thin.
      </p>
      <div class="mt-8 grid gap-3.5 sm:grid-cols-2">
        <For each={cats}>
          {(c) => (
            <div class="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4">
              <span class="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/10 text-primary">
                <c.icon class="h-[18px] w-[18px]" />
              </span>
              <div>
                <h3 class="font-semibold">{c.title}</h3>
                <p class="mt-1 text-sm text-muted-foreground">{c.body}</p>
                <div class="font-coord mt-2 text-[0.66rem] text-muted-foreground">{c.meta}</div>
              </div>
            </div>
          )}
        </For>
      </div>
    </RouteStop>
  );
}
