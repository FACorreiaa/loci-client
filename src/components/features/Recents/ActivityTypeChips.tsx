import { For } from "solid-js";
import { cn } from "~/lib/utils";

/**
 * A chip is a (kind, detail) pair. Both axes matter and they are not the same
 * question: "Itineraries" means itinerary searches, "Saved" means kept trips,
 * and neither should return the other.
 */
export interface ActivityTypeOption {
  id: string;
  label: string;
  kind?: "prompt" | "saved_itinerary" | "favourite";
  detail?: string;
}

export const ACTIVITY_TYPE_OPTIONS: ActivityTypeOption[] = [
  { id: "all", label: "All" },
  { id: "chat", label: "Chats", kind: "prompt", detail: "general" },
  { id: "itinerary", label: "Itineraries", kind: "prompt", detail: "itinerary" },
  { id: "activities", label: "Activities", kind: "prompt", detail: "activities" },
  { id: "dining", label: "Dining", kind: "prompt", detail: "dining" },
  { id: "accommodation", label: "Stays", kind: "prompt", detail: "accommodation" },
  { id: "nearby", label: "Nearby", kind: "prompt", detail: "nearby" },
  { id: "saved", label: "Saved", kind: "saved_itinerary" },
  { id: "favourite", label: "Favourites", kind: "favourite" },
];

export interface ActivityTypeChipsProps {
  value: string;
  onChange: (id: string) => void;
  /** Per-chip counts over what has loaded, so an empty chip reads as empty. */
  counts?: Record<string, number>;
}

export default function ActivityTypeChips(props: ActivityTypeChipsProps) {
  return (
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter activity by type">
      <For each={ACTIVITY_TYPE_OPTIONS}>
        {(option) => (
          <button
            type="button"
            onClick={() => props.onChange(option.id)}
            aria-pressed={props.value === option.id}
            class={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              props.value === option.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {props.counts && option.id !== "all" ? (
              <span class="ml-1.5 tabular-nums opacity-70">{props.counts[option.id] ?? 0}</span>
            ) : null}
          </button>
        )}
      </For>
    </div>
  );
}
