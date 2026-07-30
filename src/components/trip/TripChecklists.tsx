import { createSignal, createEffect, For, onMount, Show } from "solid-js";
import { Check, Plus, Printer, Trash2, Wallet, Luggage, Sparkles, Info, X } from "lucide-solid";
import { useSuggestPacking, type PackingSuggestion } from "~/lib/api/packing";

// Packing + expenditure checklists for a trip, plus a print button.
//
// The user's own list stays client-only, in localStorage per trip: it is theirs,
// it works offline, and it needs no backend surface. What the server contributes
// is *suggestions* derived from the trip — its length, its cities' forecasts, the
// driving, the stated interests — which is the part a notes app cannot do.
//
// Suggestions are offered rather than imposed: nothing is added to the list until
// the user says so, and a dismissed suggestion stays dismissed (also locally, so
// the server does not need to track it).

interface PackItem {
  id: string;
  text: string;
  done: boolean;
}
interface Expense {
  id: string;
  label: string;
  amount: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function TripChecklists(props: { tripId: string }) {
  const packKey = () => `trip-packing-${props.tripId}`;
  const expKey = () => `trip-expenses-${props.tripId}`;
  const dismissedKey = () => `trip-packing-dismissed-${props.tripId}`;

  const [pack, setPack] = createSignal<PackItem[]>([]);
  const [expenses, setExpenses] = createSignal<Expense[]>([]);
  const [packInput, setPackInput] = createSignal("");
  const [expLabel, setExpLabel] = createSignal("");
  const [expAmount, setExpAmount] = createSignal("");
  const [dismissed, setDismissed] = createSignal<string[]>([]);

  const suggested = useSuggestPacking(() => props.tripId);

  onMount(() => {
    setPack(load<PackItem[]>(packKey(), []));
    setExpenses(load<Expense[]>(expKey(), []));
    setDismissed(load<string[]>(dismissedKey(), []));
  });

  createEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(packKey(), JSON.stringify(pack()));
  });
  createEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(expKey(), JSON.stringify(expenses()));
  });
  createEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem(dismissedKey(), JSON.stringify(dismissed()));
  });

  // Hide anything the user has already added or waved away, so the panel empties
  // out as they work through it rather than nagging.
  const openSuggestions = () => {
    const taken = new Set(pack().map((i) => i.text.toLowerCase()));
    const gone = new Set(dismissed().map((d) => d.toLowerCase()));
    return (suggested.data?.suggestions ?? []).filter(
      (s) => !taken.has(s.text.toLowerCase()) && !gone.has(s.text.toLowerCase()),
    );
  };

  const acceptSuggestion = (s: PackingSuggestion) => {
    setPack((p) => [...p, { id: uid(), text: s.text, done: false }]);
  };
  const dismissSuggestion = (s: PackingSuggestion) => {
    setDismissed((d) => [...d, s.text]);
  };
  const acceptAll = () => {
    const items = openSuggestions().map((s) => ({ id: uid(), text: s.text, done: false }));
    if (items.length > 0) setPack((p) => [...p, ...items]);
  };

  const addPack = () => {
    const t = packInput().trim();
    if (!t) return;
    setPack((p) => [...p, { id: uid(), text: t, done: false }]);
    setPackInput("");
  };
  const togglePack = (id: string) =>
    setPack((p) => p.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const removePack = (id: string) => setPack((p) => p.filter((i) => i.id !== id));

  const addExpense = () => {
    const label = expLabel().trim();
    const amount = parseFloat(expAmount());
    if (!label || Number.isNaN(amount)) return;
    setExpenses((e) => [...e, { id: uid(), label, amount }]);
    setExpLabel("");
    setExpAmount("");
  };
  const removeExpense = (id: string) => setExpenses((e) => e.filter((i) => i.id !== id));

  const total = () => expenses().reduce((s, e) => s + e.amount, 0);
  const packedCount = () => pack().filter((i) => i.done).length;

  return (
    <div class="trip-extras mt-8 grid gap-6 md:grid-cols-2">
      {/* Suggestions, derived from this trip rather than a generic list. Each one
          carries the reason it was suggested: a suggestion the user cannot
          evaluate is noise, and they need enough to disagree with it. */}
      <Show when={openSuggestions().length > 0}>
        <section class="no-print rounded-lg border border-accent/30 bg-accent/5 p-4 md:col-span-2">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="flex items-center gap-2 font-medium">
              <Sparkles class="h-4 w-4 text-accent" aria-hidden="true" />
              Suggested for this trip
            </h3>
            <button
              class="rounded-md border px-2 py-1 text-xs hover:bg-accent/20"
              onClick={acceptAll}
            >
              Add all {openSuggestions().length}
            </button>
          </div>

          <ul class="grid gap-2 sm:grid-cols-2">
            <For each={openSuggestions()}>
              {(s) => (
                <li class="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-2">
                  <button
                    class="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded border hover:bg-accent/30"
                    onClick={() => acceptSuggestion(s)}
                    aria-label={`Add ${s.text} to the packing list`}
                  >
                    <Plus class="h-3 w-3" />
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm">
                      {s.text}
                      <Show when={s.essential}>
                        <span class="ml-1.5 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                          don't forget
                        </span>
                      </Show>
                    </p>
                    <Show when={s.reason}>
                      <p class="text-xs text-muted-foreground">{s.reason}</p>
                    </Show>
                  </div>
                  <button
                    class="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => dismissSuggestion(s)}
                    aria-label={`Dismiss ${s.text}`}
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </li>
              )}
            </For>
          </ul>

          <Show when={suggested.data?.weatherIsEstimated}>
            <p class="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                Weather-based suggestions use an estimated forecast — no live weather key is
                configured.
              </span>
            </p>
          </Show>
        </section>
      </Show>

      {/* Packing */}
      <section class="rounded-lg border p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="flex items-center gap-2 font-medium">
            <Luggage class="h-4 w-4 text-primary" /> Packing
          </h3>
          <Show when={pack().length > 0}>
            <span class="text-xs text-muted-foreground">
              {packedCount()}/{pack().length} packed
            </span>
          </Show>
        </div>
        <div class="mb-3 flex gap-2">
          <input
            class="flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="Add an item…"
            value={packInput()}
            onInput={(e) => setPackInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && addPack()}
          />
          <button class="rounded-md border px-2 hover:bg-accent" onClick={addPack} aria-label="Add">
            <Plus class="h-4 w-4" />
          </button>
        </div>
        <ul class="space-y-1">
          <For each={pack()}>
            {(item) => (
              <li class="flex items-center gap-2 text-sm">
                <button
                  class={`grid h-5 w-5 place-items-center rounded border ${item.done ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={() => togglePack(item.id)}
                  aria-label={item.done ? "Uncheck" : "Check"}
                >
                  <Show when={item.done}>
                    <Check class="h-3 w-3" />
                  </Show>
                </button>
                <span class={item.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
                  {item.text}
                </span>
                <button
                  class="text-muted-foreground hover:text-destructive"
                  onClick={() => removePack(item.id)}
                  aria-label="Remove"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* Expenses */}
      <section class="rounded-lg border p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="flex items-center gap-2 font-medium">
            <Wallet class="h-4 w-4 text-primary" /> Expenses
          </h3>
          <span class="text-sm font-semibold">{total().toFixed(2)}</span>
        </div>
        <div class="mb-3 flex gap-2">
          <input
            class="flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="What for…"
            value={expLabel()}
            onInput={(e) => setExpLabel(e.currentTarget.value)}
          />
          <input
            class="w-24 rounded-md border px-2 py-1 text-sm"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={expAmount()}
            onInput={(e) => setExpAmount(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && addExpense()}
          />
          <button
            class="rounded-md border px-2 hover:bg-accent"
            onClick={addExpense}
            aria-label="Add expense"
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>
        <ul class="space-y-1">
          <For each={expenses()}>
            {(e) => (
              <li class="flex items-center gap-2 text-sm">
                <span class="flex-1">{e.label}</span>
                <span class="tabular-nums">{e.amount.toFixed(2)}</span>
                <button
                  class="text-muted-foreground hover:text-destructive"
                  onClick={() => removeExpense(e.id)}
                  aria-label="Remove"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* Print */}
      <div class="no-print md:col-span-2">
        <button
          class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={() => window.print()}
        >
          <Printer class="h-4 w-4" /> Print / save as PDF
        </button>
      </div>
    </div>
  );
}
