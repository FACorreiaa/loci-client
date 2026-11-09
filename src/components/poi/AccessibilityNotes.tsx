import { For, Show } from "solid-js";
import { CarTaxiFront, Footprints, Info, OctagonAlert, TriangleAlert } from "lucide-solid";
import { cn } from "~/cn";
import {
  bySeverity,
  legSummary,
  severityLabel,
  sourceLabel,
  type AccessibilityNote,
  type AccessibleRoute,
  type NoteSeverity,
  type WalkingLeg,
} from "~/lib/accessibility";

/**
 * Severity is carried by the icon and by words for screen readers, never by
 * colour alone; colour only reinforces a barrier.
 */
const ICON = { barrier: OctagonAlert, caution: TriangleAlert, info: Info } as const;
const TONE: Record<NoteSeverity, string> = {
  barrier: "text-destructive",
  caution: "text-foreground",
  info: "text-muted-foreground",
};

export function AccessibilityNoteRow(props: { note: AccessibilityNote }) {
  const Icon = ICON[props.note.severity];
  return (
    <li class="flex items-start gap-1.5 text-xs">
      <Icon
        class={cn("mt-0.5 h-3.5 w-3.5 shrink-0", TONE[props.note.severity])}
        aria-hidden="true"
      />
      <span class="min-w-0">
        <span class="sr-only">{severityLabel[props.note.severity]}: </span>
        <span class="text-foreground">{props.note.text}</span>{" "}
        <span class="text-muted-foreground">— {sourceLabel(props.note)}</span>
      </span>
    </li>
  );
}

/**
 * A place's or a walk's access notes, most serious first. `limit` keeps a card
 * short; the hidden remainder is counted rather than silently dropped.
 */
export function AccessibilityNotesList(props: {
  notes: AccessibilityNote[] | undefined;
  limit?: number;
  class?: string;
}) {
  const sorted = () => bySeverity(props.notes ?? []);
  const shown = () => (props.limit ? sorted().slice(0, props.limit) : sorted());
  const hidden = () => sorted().length - shown().length;
  const openData = () => shown().some((n) => n.source === "open_data");
  return (
    <Show when={sorted().length > 0}>
      <div class={cn("space-y-1", props.class)}>
        <ul class="space-y-1" aria-label="Accessibility">
          <For each={shown()}>{(note) => <AccessibilityNoteRow note={note} />}</For>
        </ul>
        <Show when={hidden() > 0}>
          <p class="text-xs text-muted-foreground">
            +{hidden()} more {hidden() === 1 ? "note" : "notes"}
          </p>
        </Show>
        {/* ODbL attribution for anything drawn from OpenStreetMap / Wheelmap. */}
        <Show when={openData()}>
          <p class="text-[11px] text-muted-foreground">
            Open data via accessibility.cloud (Wheelmap) · © OpenStreetMap contributors
          </p>
        </Show>
      </div>
    </Show>
  );
}

/** The walk to a stop, shown just above its card. */
export function WalkingLegRow(props: { leg: WalkingLeg }) {
  const taxi = () => props.leg.suggest_mode;
  return (
    <div class="ml-4 border-l-2 border-dashed border-border pl-3 py-1 space-y-1">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <Footprints class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="text-foreground">{legSummary(props.leg)}</span>
        <Show when={!props.leg.routed}>
          <span>· Straight-line estimate, route not checked</span>
        </Show>
        <Show when={taxi()}>
          {(mode) => (
            <span class="inline-flex items-center gap-1 font-medium text-foreground">
              <CarTaxiFront class="h-3.5 w-3.5" aria-hidden="true" />
              {mode() === "taxi" ? "Consider a taxi" : "Consider public transport"}
            </span>
          )}
        </Show>
      </p>
      <AccessibilityNotesList notes={props.leg.notes} />
    </div>
  );
}

/** A day's walking total and any warning, under its header. */
export function RouteDaySummary(props: { route: AccessibleRoute }) {
  return (
    <div class="space-y-1">
      <p class="text-xs text-muted-foreground">
        About {props.route.total_walk_minutes} min of walking between stops
      </p>
      <For each={props.route.warnings}>
        {(w) => (
          <p class="flex items-start gap-1.5 text-xs text-foreground" role="note">
            <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span class="sr-only">Caution: </span>
              {w}
            </span>
          </p>
        )}
      </For>
    </div>
  );
}
