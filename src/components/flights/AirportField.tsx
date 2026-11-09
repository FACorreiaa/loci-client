import { For, Show, createSignal, onCleanup } from "solid-js";
import type { FlightPlace } from "~/lib/api/trips";
import type { FlightPlaceOption } from "~/lib/api/trip-plan";

const DEBOUNCE_MS = 200;
const MIN_QUERY = 2;

/** "Lisbon (LIS)", or "London (all airports)" for a metro code. */
export const optionLabel = (o: FlightPlaceOption) =>
  o.kind === "metro" ? o.name : `${o.city || o.name} (${o.iata})`;

/** The place an option stands for: the city's name and the code. */
export const optionPlace = (o: FlightPlaceOption): FlightPlace => ({
  name: o.city || o.name,
  iata: o.iata,
});

export interface AirportFieldProps {
  label: string;
  placeholder?: string;
  testId: string;
  /** What the field shows. */
  text: string;
  /** Called on every edit and pick: free text has no code, a pick has one. */
  onChange: (text: string, place: FlightPlace) => void;
  search: (query: string) => Promise<FlightPlaceOption[]>;
  class?: string;
}

let nextId = 0;

/**
 * A text field with airport suggestions (WAI-ARIA combobox). Typing is free
 * text, sent as a name; picking a suggestion attaches its IATA code, which is
 * what Skyscanner needs.
 */
export default function AirportField(props: AirportFieldProps) {
  const listId = `airport-list-${++nextId}`;
  const [options, setOptions] = createSignal<FlightPlaceOption[]>([]);
  const [active, setActive] = createSignal(-1);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  onCleanup(() => clearTimeout(timer));

  const lookup = (text: string) => {
    clearTimeout(timer);
    const q = text.trim();
    if (q.length < MIN_QUERY) {
      setOptions([]);
      return;
    }
    const id = ++seq;
    timer = setTimeout(async () => {
      try {
        const found = await props.search(q);
        if (id === seq) {
          setOptions(found);
          setActive(found.length ? 0 : -1);
        }
      } catch {
        if (id === seq) setOptions([]);
      }
    }, DEBOUNCE_MS);
  };

  const pick = (o: FlightPlaceOption) => {
    seq++;
    setOptions([]);
    setActive(-1);
    props.onChange(optionLabel(o), optionPlace(o));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = options().length;
    if (n === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter" && active() >= 0) {
      e.preventDefault();
      pick(options()[active()]);
    } else if (e.key === "Escape") {
      setOptions([]);
    }
  };

  return (
    <div class="relative">
      <input
        class={props.class}
        role="combobox"
        aria-label={props.label}
        aria-autocomplete="list"
        aria-expanded={options().length > 0}
        aria-controls={listId}
        aria-activedescendant={active() >= 0 ? `${listId}-${active()}` : undefined}
        placeholder={props.placeholder}
        autocomplete="off"
        data-testid={props.testId}
        value={props.text}
        onInput={(e) => {
          const text = e.currentTarget.value;
          props.onChange(text, { name: text });
          lookup(text);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOptions([]), 150)}
      />
      <Show when={options().length > 0}>
        <ul
          id={listId}
          role="listbox"
          class="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
        >
          <For each={options()}>
            {(o, i) => (
              <li
                id={`${listId}-${i()}`}
                role="option"
                aria-selected={active() === i()}
                class="cursor-pointer rounded px-2 py-1.5"
                classList={{ "bg-muted": active() === i() }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                <span class="font-medium">{optionLabel(o)}</span>
                <Show when={o.kind === "airport"}>
                  <span class="block text-xs text-muted-foreground">
                    {o.name} · {o.countryCode}
                  </span>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
