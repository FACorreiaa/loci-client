import { createMemo, createSignal, Show } from "solid-js";
import { MapPinPlus } from "lucide-solid";
import { useSubmitPlace } from "~/lib/api/place-intelligence";
import { capture } from "~/lib/analytics";
import { ErrorView } from "~/components/ErrorView";
import { Button } from "~/ui/button";

/**
 * Propose a place the guide does not have yet.
 *
 * Nothing submitted here reaches a recommendation until somebody else says the
 * place exists, which is why the form can stay open to any signed-in scout.
 */
export function AddPlaceForm() {
  const submit = useSubmitPlace();
  const [name, setName] = createSignal("");
  const [cityName, setCityName] = createSignal("");
  const [category, setCategory] = createSignal("");

  // The same draft keeps the same id, so resubmitting after a dropped response
  // is recognised as a repeat. Editing any field makes it a different place.
  const draftId = createMemo(() => {
    name();
    cityName();
    category();
    return crypto.randomUUID();
  });

  const ready = () => name().trim().length > 1 && cityName().trim().length > 0;

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!ready()) return;
    submit.mutate(
      {
        clientSubmissionId: draftId(),
        name: name().trim(),
        cityName: cityName().trim(),
        category: category().trim() || undefined,
      },
      {
        onSuccess: () => {
          capture("place_submitted", { city: cityName().trim() });
          setName("");
          setCategory("");
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} class="rounded-xl border border-border bg-card p-6">
      <p class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">Add a place</p>
      <h2 class="mt-2 text-2xl">Something we are missing</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        It goes live once another scout confirms it exists.
      </p>

      <label class="mt-5 block text-sm font-semibold" for="place-name">
        What is it called?
      </label>
      <input
        id="place-name"
        value={name()}
        onInput={(event) => setName(event.currentTarget.value)}
        maxlength={300}
        class="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <label class="mt-4 block text-sm font-semibold" for="place-city">
        Which city?
      </label>
      <input
        id="place-city"
        value={cityName()}
        onInput={(event) => setCityName(event.currentTarget.value)}
        maxlength={200}
        class="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <label class="mt-4 block text-sm font-semibold" for="place-category">
        What kind of place? <span class="font-normal text-muted-foreground">Optional</span>
      </label>
      <input
        id="place-category"
        value={category()}
        onInput={(event) => setCategory(event.currentTarget.value)}
        maxlength={100}
        placeholder="cafe, museum, viewpoint…"
        class="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <Button type="submit" class="mt-5 w-full gap-2" disabled={!ready() || submit.isPending}>
        <MapPinPlus class="h-4 w-4" />
        {submit.isPending ? "Submitting…" : "Add this place"}
      </Button>

      <Show when={submit.isError}>
        <ErrorView error={submit.error} class="mt-4" />
      </Show>

      <Show when={submit.isSuccess}>
        <p class="mt-4 rounded-lg bg-secondary/50 p-3 text-center text-sm">
          {submit.data?.promoted
            ? "Another scout had already proposed this place. With you, it is on the guide now."
            : "Recorded. One more scout needs to confirm this place exists."}
        </p>
      </Show>
    </form>
  );
}

export default AddPlaceForm;
