import { createSignal, For, Show } from "solid-js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/ui/table";
import type { GlobeArc, VisitedCity } from "~/lib/api/travel-history";

interface ActivitiesDrawerProps {
  cities: VisitedCity[];
  arcs: GlobeArc[];
  selectedLegId?: string;
  onSelectLeg: (id: string | undefined) => void;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const nf = new Intl.NumberFormat();

/**
 * Expandable activity panel over the globe.
 *
 * Kobalte Accordion, deliberately NOT src/ui/sheet.tsx with side="bottom".
 * SheetContent renders a Dialog with an inset-0 backdrop-blur overlay and sets
 * aria-modal, which would (a) blur the globe behind it and (b) trap focus, so
 * you could not pan the globe while reading the table. A persistent inline
 * panel must not be modal — the absence of a focus trap here is the feature,
 * not an omission.
 */
export default function ActivitiesDrawer(props: ActivitiesDrawerProps) {
  const [expanded, setExpanded] = createSignal<string[]>([]);
  let triggerRef: HTMLButtonElement | undefined;

  const collapse = () => {
    setExpanded([]);
    triggerRef?.focus();
  };

  return (
    <Accordion
      collapsible
      value={expanded()}
      onChange={setExpanded}
      class="island-panel fixed inset-x-0 bottom-0 z-30 rounded-t-2xl md:inset-x-auto md:left-1/2 md:w-[min(72rem,90vw)] md:-translate-x-1/2"
      onKeyDown={(e: KeyboardEvent) => {
        // Non-modal, so Escape has no default behaviour here. Wiring it is both
        // cheap and what anyone would expect from a panel.
        if (e.key === "Escape" && expanded().length > 0) {
          e.stopPropagation();
          collapse();
        }
      }}
    >
      <AccordionItem value="activities" class="border-b-0">
        <AccordionTrigger ref={triggerRef} class="min-h-[44px] px-4">
          <span class="ui-label">Activities</span>
          <span class="font-coord mr-2 text-xs text-muted-foreground">
            {props.arcs.length} {props.arcs.length === 1 ? "leg" : "legs"} · {props.cities.length}{" "}
            {props.cities.length === 1 ? "city" : "cities"}
          </span>
        </AccordionTrigger>

        <AccordionContent>
          <Show
            when={props.arcs.length > 0 || props.cities.length > 0}
            fallback={
              <p class="px-4 pb-4 text-sm text-muted-foreground">
                Nothing recorded yet. Trips with real dates in the past, and stops you mark as
                visited, show up here.
              </p>
            }
          >
            {/* tabindex + role + label: axe flags scrollable regions with no
                keyboard path, and that alone would break the 1.0 bar. */}
            <div
              role="group"
              tabindex="0"
              aria-label="Travel activity, scrollable"
              class="max-h-[46vh] overflow-y-auto px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Table>
                <caption class="sr-only">
                  Legs between the cities you have visited, most recent first
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">From</TableHead>
                    <TableHead scope="col">To</TableHead>
                    <TableHead scope="col">Mode</TableHead>
                    <TableHead scope="col">Distance</TableHead>
                    <TableHead scope="col">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={props.arcs}>
                    {(arc, i) => {
                      const id = () => `${arc.tripId ?? "leg"}-${i()}`;
                      return (
                        <TableRow
                          class={`cursor-pointer ${
                            props.selectedLegId === id() ? "bg-primary/10" : ""
                          }`}
                          onClick={() =>
                            props.onSelectLeg(props.selectedLegId === id() ? undefined : id())
                          }
                        >
                          <TableCell>{arc.fromName || "—"}</TableCell>
                          <TableCell>{arc.toName || "—"}</TableCell>
                          {/* Empty when the trip recorded no mode. Not guessed. */}
                          <TableCell class="capitalize">{arc.mode || "—"}</TableCell>
                          <TableCell class="tabular-nums">
                            {nf.format(Math.round(arc.distanceKm))} km
                          </TableCell>
                          <TableCell class="tabular-nums">
                            {arc.occurredAt ? dateFmt.format(arc.occurredAt) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    }}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
