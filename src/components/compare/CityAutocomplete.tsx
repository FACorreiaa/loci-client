import { createMemo, createSignal, For, Show } from "solid-js";
import { Loader2, MapPin } from "lucide-solid";
import { MIN_CITY_QUERY_LENGTH, useCitySearch, type City } from "~/lib/api/cities";

/**
 * A city, as chosen in the form.
 *
 * Coordinates are optional because free-typed text is still a valid choice —
 * the server can resolve a name it has never seen. When they are present the
 * server skips name resolution entirely, which is the difference between
 * answering from a stored row and paying for a lookup.
 */
export interface CitySelection {
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
  cityId?: string;
}

interface CityAutocompleteProps {
  label: string;
  placeholder?: string;
  value?: CitySelection | null;
  /** Names already chosen elsewhere, so the same city cannot be picked twice. */
  excludeNames?: string[];
  disabled?: boolean;
  /** Clear the input after a selection. Used by the multi-select candidates field. */
  clearOnSelect?: boolean;
  onSelect: (city: CitySelection) => void;
}

export function CityAutocomplete(props: CityAutocompleteProps) {
  const [query, setQuery] = createSignal(props.value?.name ?? "");
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);

  const search = useCitySearch(query);

  const excluded = createMemo(
    () => new Set((props.excludeNames ?? []).map((n) => n.trim().toLowerCase())),
  );

  const results = createMemo<City[]>(() => {
    const list = search.data ?? [];
    return list.filter((c) => !excluded().has(c.name.trim().toLowerCase()));
  });

  const showList = createMemo(() => open() && query().trim().length >= MIN_CITY_QUERY_LENGTH);

  const choose = (city: City) => {
    props.onSelect({
      name: city.name,
      country: city.country,
      lat: city.centerLatitude,
      lon: city.centerLongitude,
      // Empty for a geocoded suggestion with no row yet, which is meaningful
      // rather than missing: the server will create it.
      cityId: city.id || undefined,
    });
    setQuery(props.clearOnSelect ? "" : city.name);
    setOpen(false);
    setActive(0);
  };

  // Text nobody picked from the list is still usable: the server resolves names.
  // Without this, typing a city and pressing the button would silently do
  // nothing, which is exactly the kind of dead end this field replaces.
  const commitTyped = () => {
    const typed = query().trim();
    if (!typed) return;
    props.onSelect({ name: typed });
    if (props.clearOnSelect) setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const list = results();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setActive((i) => (list.length === 0 ? 0 : (i + 1) % list.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (list.length === 0 ? 0 : (i - 1 + list.length) % list.length));
        break;
      case "Enter": {
        // Enter inside a form would submit it, which is wrong while a list of
        // choices is open.
        e.preventDefault();
        const picked = showList() ? list[active()] : undefined;
        if (picked) choose(picked);
        else commitTyped();
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  };

  const listId = `city-options-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div class="relative">
      <label class="block">
        <span class="text-sm font-medium">{props.label}</span>
        <div class="mt-1 flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:border-primary">
          <MapPin class="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            class="flex-1 bg-transparent outline-none disabled:opacity-50"
            role="combobox"
            aria-expanded={showList()}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showList() && results().length > 0 ? `${listId}-${active()}` : undefined
            }
            autocomplete="off"
            disabled={props.disabled}
            placeholder={props.placeholder}
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            // A frame's delay, so a click on an option is registered before the
            // list is torn down by the blur.
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />
          <Show when={search.isFetching}>
            <Loader2 class="w-4 h-4 animate-spin text-muted-foreground" />
          </Show>
        </div>
      </label>

      <Show when={showList()}>
        <ul
          id={listId}
          role="listbox"
          class="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border bg-card shadow-lg"
        >
          <For each={results()}>
            {(city, i) => (
              <li
                id={`${listId}-${i()}`}
                role="option"
                aria-selected={i() === active()}
                class="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                classList={{ "bg-muted": i() === active() }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(city)}
              >
                <span class="font-medium">{city.name}</span>
                {/* The country is what separates Porto in Portugal from Porto
                    in Brazil. The server always picks the larger one; this is
                    where someone who meant the other says so. */}
                <Show when={city.country}>
                  <span class="text-muted-foreground"> · {city.country}</span>
                </Show>
              </li>
            )}
          </For>

          <Show when={!search.isFetching && results().length === 0}>
            <li class="px-3 py-2 text-sm text-muted-foreground">
              No matches. Press Enter to use “{query().trim()}” anyway.
            </li>
          </Show>
        </ul>
      </Show>
    </div>
  );
}

export default CityAutocomplete;
