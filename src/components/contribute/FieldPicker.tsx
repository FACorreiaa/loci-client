import { For, Show } from "solid-js";
import type { PlaceFactField } from "~/lib/api/place-intelligence";
import type { OpeningHours } from "~/lib/place-facts/opening-hours";
import { EXCLUSIVE_TOKEN, vocabularyFor } from "~/lib/place-facts/vocabulary";
import { ToggleGroup, ToggleGroupItem } from "~/ui/toggle-group";
import { OpeningHoursPicker } from "./OpeningHoursPicker";

/**
 * The answer control for one field.
 *
 * Every field is a choice from a fixed vocabulary rather than free text,
 * because a report only counts once a second scout files a byte-identical one —
 * which prose never is.
 */
export function FieldPicker(props: {
  field: PlaceFactField;
  tokens: string[];
  onTokensChange: (tokens: string[]) => void;
  hours: OpeningHours;
  onHoursChange: (hours: OpeningHours) => void;
}) {
  const vocabulary = () => vocabularyFor(props.field);

  // "None of these" is a statement that the rest do not apply, so it cannot be
  // selected alongside them. The server rejects that pairing too.
  const applyExclusivity = (next: string[]) => {
    const added = next.find((token) => !props.tokens.includes(token));
    if (added === EXCLUSIVE_TOKEN) return [EXCLUSIVE_TOKEN];
    return next.filter((token) => token !== EXCLUSIVE_TOKEN);
  };

  const onMultiChange = (next: string[]) => {
    const cleaned = applyExclusivity(next);
    const cap = vocabulary().maxSelections;
    // Drop the oldest rather than refusing the click: a capped picker that goes
    // dead under the finger reads as broken.
    props.onTokensChange(cap && cleaned.length > cap ? cleaned.slice(-cap) : cleaned);
  };

  return (
    <div class="mt-2">
      <Show when={vocabulary().kind === "structured"}>
        <OpeningHoursPicker value={props.hours} onChange={props.onHoursChange} />
      </Show>

      <Show when={vocabulary().kind === "single"}>
        <ToggleGroup
          size="sm"
          variant="outline"
          value={props.tokens[0] ?? ""}
          onChange={(token) => props.onTokensChange(token ? [token as string] : [])}
          aria-label={vocabulary().question}
          class="flex-wrap justify-start"
        >
          <For each={vocabulary().options}>
            {(option) => (
              <ToggleGroupItem value={option.token} aria-label={option.label}>
                {option.label}
              </ToggleGroupItem>
            )}
          </For>
        </ToggleGroup>
      </Show>

      <Show when={vocabulary().kind === "multi"}>
        <ToggleGroup
          multiple
          size="sm"
          variant="outline"
          value={props.tokens}
          onChange={(tokens) => onMultiChange((tokens as string[]) ?? [])}
          aria-label={vocabulary().question}
          class="flex-wrap justify-start"
        >
          <For each={vocabulary().options}>
            {(option) => (
              <ToggleGroupItem value={option.token} aria-label={option.label}>
                {option.label}
              </ToggleGroupItem>
            )}
          </For>
        </ToggleGroup>
      </Show>
    </div>
  );
}
