import { createEffect, createSignal, For, Show } from "solid-js";
import { Check, Plus, Printer, Trash2, Wallet, Luggage, Sparkles, Info, X } from "lucide-solid";
import { useSuggestPacking, type PackingSuggestion } from "~/lib/api/packing";
import {
  importLegacyChecklist,
  useDeleteChecklistItem,
  useDismissPackingSuggestion,
  useTripChecklist,
  useUpsertChecklistItem,
  useUpsertChecklistItems,
} from "~/lib/api/checklist";
import {
  clipText,
  fromMinor,
  newChecklistId,
  nextPosition,
  toMinor,
  totalsByCurrency,
  type ChecklistEntry,
} from "~/lib/trip-checklist/checklist";
import { useLocale } from "~/contexts/LocaleContext";
import { formatPrice } from "~/lib/locale";

// Packing + expenditure checklists for a trip, plus a print button.
//
// The lists are the user's own and sync through the server (TripService's
// checklist RPCs), so a box ticked on the phone is ticked here. They used to
// live only in this browser's localStorage; the first visit after this change
// imports that copy once and then clears it.
//
// The server also contributes *suggestions* derived from the trip — its length,
// its cities' forecasts, the driving, the stated interests. They are offered
// rather than imposed: nothing is added until the user says so, and a dismissed
// suggestion stays dismissed (on every device).

export default function TripChecklists(props: { tripId: string }) {
  const tripId = () => props.tripId;
  const locale = useLocale();

  const checklist = useTripChecklist(tripId);
  const upsertItem = useUpsertChecklistItem(tripId);
  const upsertItems = useUpsertChecklistItems(tripId);
  const deleteItem = useDeleteChecklistItem(tripId);
  const dismissSuggestionRpc = useDismissPackingSuggestion(tripId);

  const [packInput, setPackInput] = createSignal("");
  const [expLabel, setExpLabel] = createSignal("");
  const [expAmount, setExpAmount] = createSignal("");
  const [writeError, setWriteError] = createSignal<string | null>(null);

  const suggested = useSuggestPacking(tripId);

  const items = () => checklist.data?.items ?? [];
  const pack = () => items().filter((i) => i.kind === "packing");
  const expenses = () => items().filter((i) => i.kind === "expense");
  const dismissed = () => checklist.data?.dismissed ?? [];

  // One-time import of the localStorage lists an older build kept for this
  // trip. Waits for the server copy so it can skip what is already there.
  let importedFor: string | undefined;
  createEffect(() => {
    const data = checklist.data;
    const id = props.tripId;
    if (!data || importedFor === id) return;
    importedFor = id;
    importLegacyChecklist(id, data, locale.currency())
      .then((uploaded) => {
        if (uploaded) void checklist.refetch();
      })
      .catch((err) => {
        // Keys stay in localStorage; the next visit tries again.
        console.warn("checklist import failed", err);
      });
  });

  const onWriteError = () =>
    setWriteError("That change didn't save. Check your connection and try again.");
  const write = { onError: onWriteError, onSuccess: () => setWriteError(null) };

  // Hide anything the user has already added or waved away, so the panel empties
  // out as they work through it rather than nagging.
  const openSuggestions = () => {
    const taken = new Set(pack().map((i) => i.text.toLowerCase()));
    const gone = new Set(dismissed().map((d) => d.toLowerCase()));
    return (suggested.data?.suggestions ?? []).filter(
      (s) => !taken.has(s.text.toLowerCase()) && !gone.has(s.text.toLowerCase()),
    );
  };

  const packingEntry = (text: string, position: number): ChecklistEntry => ({
    id: newChecklistId(),
    kind: "packing",
    text: clipText(text),
    done: false,
    amountMinor: 0,
    currency: "",
    position,
  });

  const acceptSuggestion = (s: PackingSuggestion) =>
    upsertItem.mutate(packingEntry(s.text, nextPosition(items(), "packing")), write);
  const dismissSuggestion = (s: PackingSuggestion) =>
    dismissSuggestionRpc.mutate(clipText(s.text), write);
  const acceptAll = () => {
    const start = nextPosition(items(), "packing");
    const batch = openSuggestions().map((s, i) => packingEntry(s.text, start + i));
    if (batch.length > 0) upsertItems.mutate(batch, write);
  };

  const addPack = () => {
    const t = clipText(packInput());
    if (!t) return;
    upsertItem.mutate(packingEntry(t, nextPosition(items(), "packing")), write);
    setPackInput("");
  };
  const togglePack = (item: ChecklistEntry) =>
    upsertItem.mutate({ ...item, done: !item.done }, write);
  const removeItem = (id: string) => deleteItem.mutate(id, write);

  const addExpense = () => {
    const label = clipText(expLabel());
    const currency = locale.currency();
    const minor = toMinor(parseFloat(expAmount()), currency);
    if (!label || minor === null) return;
    upsertItem.mutate(
      {
        id: newChecklistId(),
        kind: "expense",
        text: label,
        done: false,
        amountMinor: minor,
        currency,
        position: nextPosition(items(), "expense"),
      },
      write,
    );
    setExpLabel("");
    setExpAmount("");
  };

  const money = (minor: number, currency: string) =>
    currency ? formatPrice(fromMinor(minor, currency), currency) : (minor / 100).toFixed(2);
  const totals = () => [...totalsByCurrency(expenses())];
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

      <Show when={checklist.isError}>
        <p class="no-print text-sm text-destructive md:col-span-2" role="alert">
          Your checklists didn&apos;t load.{" "}
          <button class="underline" onClick={() => void checklist.refetch()}>
            Try again
          </button>
        </p>
      </Show>
      <Show when={writeError()}>
        <p class="no-print text-sm text-destructive md:col-span-2" role="alert">
          {writeError()}
        </p>
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
                  onClick={() => togglePack(item)}
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
                  onClick={() => removeItem(item.id)}
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
          <span class="text-sm font-semibold tabular-nums">
            <Show when={totals().length > 0} fallback={money(0, locale.currency())}>
              {totals()
                .map(([currency, minor]) => money(minor, currency))
                .join(" + ")}
            </Show>
          </span>
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
                <span class="flex-1">{e.text}</span>
                <span class="tabular-nums">{money(e.amountMinor, e.currency)}</span>
                <button
                  class="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(e.id)}
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
